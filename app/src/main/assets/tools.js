/* NABTA Toolkit: keyboard helpers, reports, CSV export and data diagnostics.
   This file is intentionally dependency-free and runs entirely in the browser. */
(() => {
  "use strict";

  const byId = id => document.getElementById(id);
  const safeText = value => String(value ?? "").replace(/[<>&"]/g, char => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;"
  })[char]);
  const toNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const localDate = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  class CsvBuilder {
    constructor(delimiter = ",") {
      this.delimiter = delimiter;
      this.rows = [];
    }

    addRow(values) {
      this.rows.push(values.map(value => this.escape(value)));
      return this;
    }

    escape(value) {
      const text = String(value ?? "");
      return `"${text.replace(/"/g, '""')}"`;
    }

    toString() {
      return "\uFEFF" + this.rows.map(row => row.join(this.delimiter)).join("\r\n");
    }

    download(filename) {
      const blob = new Blob([this.toString()], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    }
  }

  class DataInspector {
    constructor(snapshot) {
      this.snapshot = snapshot || {};
      this.errors = [];
      this.warnings = [];
    }

    checkArray(key) {
      if (!Array.isArray(this.snapshot[key])) {
        this.errors.push(`الحقل ${key} يجب أن يكون قائمة.`);
        return false;
      }
      return true;
    }

    checkUniqueIds(key) {
      if (!this.checkArray(key)) return;
      const ids = this.snapshot[key].map(item => item && item.id).filter(Boolean);
      if (new Set(ids).size !== ids.length) {
        this.warnings.push(`هناك معرفات مكررة في ${key}.`);
      }
    }

    checkRequiredFields(key, fields) {
      if (!this.checkArray(key)) return;
      this.snapshot[key].forEach((item, index) => {
        fields.forEach(field => {
          if (!item || item[field] === undefined || item[field] === null) {
            this.errors.push(`${key}[${index}] ينقصه الحقل ${field}.`);
          }
        });
      });
    }

    inspect() {
      ["tasks", "notes", "expenses", "habits"].forEach(key => {
        this.checkArray(key);
        this.checkUniqueIds(key);
      });
      this.checkRequiredFields("tasks", ["id", "title"]);
      this.checkRequiredFields("notes", ["id", "title", "content"]);
      this.checkRequiredFields("expenses", ["id", "title", "amount", "date"]);
      this.checkRequiredFields("habits", ["id", "title"]);
      return {
        valid: this.errors.length === 0,
        errors: this.errors,
        warnings: this.warnings
      };
    }
  }

  class MonthlyReport {
    constructor(data) {
      this.data = data || {};
      this.month = localDate().slice(0, 7);
    }

    expenses() {
      return (this.data.expenses || []).filter(item =>
        String(item.date || "").startsWith(this.month)
      );
    }

    totalSpent() {
      return this.expenses().reduce((sum, item) => sum + toNumber(item.amount), 0);
    }

    byCategory() {
      return this.expenses().reduce((groups, item) => {
        const category = item.category || "other";
        groups[category] = (groups[category] || 0) + toNumber(item.amount);
        return groups;
      }, {});
    }

    taskStats() {
      const tasks = this.data.tasks || [];
      const completed = tasks.filter(task => task.done).length;
      return {
        total: tasks.length,
        completed,
        remaining: tasks.length - completed,
        rate: tasks.length ? Math.round(completed / tasks.length * 100) : 0
      };
    }

    habitStats() {
      const habits = this.data.habits || [];
      const done = habits.filter(habit =>
        habit.done && habit.date === localDate()
      ).length;
      return {
        total: habits.length,
        done,
        rate: habits.length ? Math.round(done / habits.length * 100) : 0
      };
    }

    buildText() {
      const task = this.taskStats();
      const habit = this.habitStats();
      const lines = [
        "تقرير نبتة الشهري",
        `الشهر: ${this.month}`,
        `إجمالي المصروفات: ${this.totalSpent().toFixed(2)} جنيه`,
        `عدد المصروفات: ${this.expenses().length}`,
        `المهام المكتملة: ${task.completed} من ${task.total} (${task.rate}%)`,
        `العادات المنجزة اليوم: ${habit.done} من ${habit.total} (${habit.rate}%)`,
        "",
        "المصروفات حسب التصنيف:"
      ];
      Object.entries(this.byCategory()).forEach(([category, amount]) => {
        lines.push(`- ${category}: ${amount.toFixed(2)} جنيه`);
      });
      return lines.join("\n");
    }
  }

  function exportExpensesCsv(data) {
    const csv = new CsvBuilder();
    csv.addRow(["اسم المصروف", "المبلغ", "التصنيف", "التاريخ"]);
    (data.expenses || []).forEach(item => {
      csv.addRow([item.title, item.amount, item.category, item.date]);
    });
    csv.download(`nabta-expenses-${localDate()}.csv`);
  }

  function exportTasksCsv(data) {
    const csv = new CsvBuilder();
    csv.addRow(["المهمة", "التفاصيل", "الأولوية", "تاريخ الاستحقاق", "الحالة"]);
    (data.tasks || []).forEach(item => {
      csv.addRow([
        item.title,
        item.description,
        item.priority,
        item.due,
        item.done ? "مكتملة" : "قيد التنفيذ"
      ]);
    });
    csv.download(`nabta-tasks-${localDate()}.csv`);
  }

  function showReport(data) {
    const report = new MonthlyReport(data);
    const content = report.buildText();
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop show";
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-heading">
          <h3>ملخص تقدمك</h3>
          <button class="icon-btn" type="button" data-close-report>×</button>
        </div>
        <pre style="white-space:pre-wrap;line-height:2;font-family:inherit;color:var(--text)">${safeText(content)}</pre>
        <div class="modal-actions">
          <button class="secondary-btn" type="button" data-copy-report>نسخ التقرير</button>
          <button class="primary-btn" type="button" data-close-report>إغلاق</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", async event => {
      if (event.target === overlay || event.target.closest("[data-close-report]")) {
        overlay.remove();
      }
      if (event.target.closest("[data-copy-report]")) {
        try {
          await navigator.clipboard.writeText(content);
          event.target.textContent = "تم النسخ ✓";
        } catch {
          event.target.textContent = "تعذر النسخ";
        }
      }
    });
  }

  function bindKeyboardShortcuts() {
    document.addEventListener("keydown", event => {
      const target = event.target;
      const typing = target && (
        target.matches("input, textarea, select") ||
        target.isContentEditable
      );
      if (typing || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "Escape") {
        document.getElementById("sidebar")?.classList.remove("open");
      }
      if (event.key.toLowerCase() === "t") {
        document.getElementById("addTask")?.click();
      }
      if (event.key.toLowerCase() === "n") {
        document.getElementById("addNote")?.click();
      }
      if (event.key.toLowerCase() === "f") {
        document.querySelector('[data-view="focus"]')?.click();
      }
    });
  }

  function addExtraSettingsControls() {
    const settings = document.querySelector("#view-settings .settings-grid");
    if (!settings || settings.querySelector("[data-extra-tools]")) return;
    const panel = document.createElement("article");
    panel.className = "panel setting-row";
    panel.dataset.extraTools = "true";
    panel.innerHTML = `
      <div>
        <h3>تقارير وتصدير</h3>
        <p>نزّل المهام أو المصروفات كملف CSV، أو اعرض ملخص تقدمك.</p>
      </div>
      <div class="setting-actions">
        <button class="secondary-btn" type="button" data-export-tasks>تصدير المهام CSV</button>
        <button class="secondary-btn" type="button" data-export-expenses>تصدير المصروفات CSV</button>
        <button class="primary-btn" type="button" data-month-report>عرض التقرير</button>
      </div>`;
    settings.appendChild(panel);
  }

  function connectExtras() {
    const readData = () => {
      try {
        return JSON.parse(localStorage.getItem("nabta.app.data.v1")) || {};
      } catch {
        return {};
      }
    };

    addExtraSettingsControls();
    bindKeyboardShortcuts();

    document.addEventListener("click", event => {
      const data = readData();
      if (event.target.closest("[data-export-tasks]")) exportTasksCsv(data);
      if (event.target.closest("[data-export-expenses]")) exportExpensesCsv(data);
      if (event.target.closest("[data-month-report]")) showReport(data);
    });

    const result = new DataInspector(readData()).inspect();
    if (!result.valid || result.warnings.length) {
      console.info("Nabta data diagnostics:", result);
    }
  }

  document.addEventListener("DOMContentLoaded", connectExtras);
})();

  // Small accessibility helpers keep the interface comfortable for keyboard users.
  function improveAccessibility() {
    document.querySelectorAll("button:not([aria-label])").forEach(button => {
      if (!button.getAttribute("title") && button.textContent.trim() === "×") {
        button.setAttribute("aria-label", "إغلاق أو حذف العنصر");
      }
    });
    document.documentElement.setAttribute("lang", "ar");
    document.documentElement.setAttribute("dir", "rtl");
  }

  document.addEventListener("DOMContentLoaded", improveAccessibility);
