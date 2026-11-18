/* NABTA - Personal daily organizer
   All user data stays in localStorage on this device.
*/
(() => {
  "use strict";

  const STORAGE_KEY = "nabta.app.data.v1";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const today = () => new Date().toISOString().slice(0, 10);
  const money = value => `${Number(value || 0).toLocaleString("ar-EG")} ج.م`;
  const dateLabel = value => {
    if (!value) return "";
    return new Date(`${value}T12:00:00`).toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
  };

  const initialData = {
    profile: { name: "صديقي" },
    tasks: [],
    notes: [],
    expenses: [],
    habits: [
      { id: uid(), title: "شرب الماء", emoji: "💧", description: "اهتم بترطيب جسمك", done: false, date: today() },
      { id: uid(), title: "قراءة 10 صفحات", emoji: "📚", description: "غذّي عقلك كل يوم", done: false, date: today() },
      { id: uid(), title: "مشي بسيط", emoji: "🚶", description: "تحرك ولو لمدة قصيرة", done: false, date: today() }
    ],
    theme: "light"
  };

  let data = loadData();
  let taskFilter = "all";
  let timer = { duration: 25 * 60, remaining: 25 * 60, interval: null, running: false };
  let modalSubmit = null;

  function loadData() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || typeof saved !== "object") return structuredClone(initialData);
      return {
        ...structuredClone(initialData),
        ...saved,
        profile: { ...initialData.profile, ...(saved.profile || {}) },
        tasks: Array.isArray(saved.tasks) ? saved.tasks : [],
        notes: Array.isArray(saved.notes) ? saved.notes : [],
        expenses: Array.isArray(saved.expenses) ? saved.expenses : [],
        habits: Array.isArray(saved.habits) ? saved.habits : []
      };
    } catch (error) {
      console.warn("تعذر قراءة البيانات المحفوظة", error);
      return structuredClone(initialData);
    }
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      toast("مساحة التخزين ممتلئة، صدّر بياناتك أولاً.");
    }
    renderAll();
  }

  function toast(message) {
    const element = $("#toast");
    element.textContent = message;
    element.classList.add("show");
    clearTimeout(toast.timeout);
    toast.timeout = setTimeout(() => element.classList.remove("show"), 2600);
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function emptyState(icon, title, description) {
    return `<div class="empty-state"><b>${icon}</b><strong>${title}</strong><div>${description}</div></div>`;
  }

  function showModal(title, fields, submitHandler) {
    $("#modalTitle").textContent = title;
    $("#modalFields").innerHTML = fields;
    modalSubmit = submitHandler;
    $("#modalBackdrop").classList.add("show");
    $("#modalBackdrop").setAttribute("aria-hidden", "false");
    setTimeout(() => $("#modalFields input, #modalFields textarea, #modalFields select")?.focus(), 50);
  }

  function closeModal() {
    $("#modalBackdrop").classList.remove("show");
    $("#modalBackdrop").setAttribute("aria-hidden", "true");
    $("#modalForm").reset();
    modalSubmit = null;
  }

  function field(label, name, type = "text", value = "", extra = "") {
    const safe = escapeHTML(value);
    if (type === "textarea") {
      return `<div class="form-field"><label for="${name}">${label}</label><textarea class="field-textarea" id="${name}" name="${name}" ${extra}>${safe}</textarea></div>`;
    }
    return `<div class="form-field"><label for="${name}">${label}</label><input class="field-input" id="${name}" name="${name}" type="${type}" value="${safe}" ${extra}></div>`;
  }

  function selectField(label, name, options, selected) {
    const html = options.map(([value, text]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${text}</option>`).join("");
    return `<div class="form-field"><label for="${name}">${label}</label><select class="field-select" id="${name}" name="${name}">${html}</select></div>`;
  }

  function openTaskModal(task = null) {
    const editing = Boolean(task);
    const fields = [
      field("اسم المهمة", "title", "text", task?.title || "", 'required maxlength="90" placeholder="مثلاً: مذاكرة ساعة"'),
      field("تفاصيل (اختياري)", "description", "textarea", task?.description || "", 'maxlength="500" placeholder="اكتب تفاصيل تساعدك..."'),
      selectField("الأولوية", "priority", [["low", "منخفضة"], ["medium", "متوسطة"], ["high", "عالية"]], task?.priority || "medium"),
      field("تاريخ الاستحقاق", "due", "date", task?.due || today())
    ].join("");
    showModal(editing ? "تعديل المهمة" : "إضافة مهمة جديدة", fields, values => {
      const item = {
        id: task?.id || uid(),
        title: values.title.trim(),
        description: values.description.trim(),
        priority: values.priority,
        due: values.due,
        done: task?.done || false,
        createdAt: task?.createdAt || new Date().toISOString()
      };
      if (editing) data.tasks = data.tasks.map(entry => entry.id === task.id ? item : entry);
      else data.tasks.unshift(item);
      saveData();
      toast(editing ? "تم تحديث المهمة" : "تمت إضافة المهمة");
    });
  }

  function openNoteModal(note = null) {
    const editing = Boolean(note);
    const fields = [
      field("عنوان الملاحظة", "title", "text", note?.title || "", 'required maxlength="80" placeholder="عنوان مختصر"'),
      field("المحتوى", "content", "textarea", note?.content || "", 'required maxlength="3000" placeholder="اكتب فكرتك هنا..."')
    ].join("");
    showModal(editing ? "تعديل الملاحظة" : "ملاحظة جديدة", fields, values => {
      const item = { id: note?.id || uid(), title: values.title.trim(), content: values.content.trim(), updatedAt: new Date().toISOString() };
      if (editing) data.notes = data.notes.map(entry => entry.id === note.id ? item : entry);
      else data.notes.unshift(item);
      saveData();
      toast("تم حفظ الملاحظة");
    });
  }

  function openExpenseModal() {
    const fields = [
      field("اسم المصروف", "title", "text", "", 'required maxlength="70" placeholder="مثلاً: مواصلات"'),
      field("المبلغ بالجنيه", "amount", "number", "", 'required min="0.01" step="0.01" placeholder="0.00"'),
      selectField("التصنيف", "category", [["food", "طعام"], ["transport", "مواصلات"], ["shopping", "تسوق"], ["bills", "فواتير"], ["health", "صحة"], ["other", "أخرى"]], "other"),
      field("التاريخ", "date", "date", today(), "required")
    ].join("");
    showModal("إضافة مصروف", fields, values => {
      const amount = Number(values.amount);
      if (!Number.isFinite(amount) || amount <= 0) return toast("اكتب مبلغاً صحيحاً");
      data.expenses.unshift({ id: uid(), title: values.title.trim(), amount, category: values.category, date: values.date });
      saveData();
      toast("تم تسجيل المصروف");
    });
  }

  function openHabitModal() {
    const fields = [
      field("اسم العادة", "title", "text", "", 'required maxlength="55" placeholder="مثلاً: ممارسة الرياضة"'),
      field("رمز تعبيري", "emoji", "text", "🌟", 'maxlength="5"'),
      field("وصف بسيط", "description", "text", "", 'maxlength="90" placeholder="ما الذي تريد تحقيقه؟"')
    ].join("");
    showModal("إضافة عادة جديدة", fields, values => {
      data.habits.push({ id: uid(), title: values.title.trim(), emoji: values.emoji || "🌟", description: values.description.trim(), done: false, date: today() });
      saveData();
      toast("عادة جديدة بدأت 🌱");
    });
  }

  function renderOverview() {
    const done = data.tasks.filter(task => task.done).length;
    const pending = data.tasks.length - done;
    const habitsDone = data.habits.filter(habit => habit.done && habit.date === today()).length;
    const month = today().slice(0, 7);
    const spent = data.expenses.filter(expense => expense.date?.startsWith(month)).reduce((sum, expense) => sum + Number(expense.amount), 0);
    $("#statDone").textContent = done;
    $("#statPending").textContent = pending;
    $("#statHabits").textContent = `${habitsDone}/${data.habits.length}`;
    $("#statSpent").textContent = money(spent);
    const tasks = data.tasks.filter(task => !task.done).slice(0, 5);
    $("#overviewTasks").innerHTML = tasks.length ? tasks.map(task => `
      <div class="compact-item"><input class="task-check" type="checkbox" data-task-check="${task.id}" aria-label="إنهاء المهمة">
      <strong>${escapeHTML(task.title)}</strong><small>${dateLabel(task.due)}</small></div>`).join("") : emptyState("🎉", "مفيش مهام معلقة", "استمتع بوقتك أو أضف مهمة جديدة.");
    $("#overviewHabits").innerHTML = data.habits.slice(0, 4).map(habit => `
      <div class="compact-item"><span>${escapeHTML(habit.emoji)}</span><strong>${escapeHTML(habit.title)}</strong><small>${habit.done && habit.date === today() ? "تمت ✓" : "لسه"}</small></div>`).join("") || emptyState("🌱", "ابدأ عادة جديدة", "العادات الصغيرة تصنع فرقاً.");
  }

  function renderTasks() {
    const query = $("#taskSearch").value.trim().toLowerCase();
    const filtered = data.tasks.filter(task => {
      const matchesFilter = taskFilter === "all" || (taskFilter === "open" && !task.done) || (taskFilter === "done" && task.done);
      return matchesFilter && `${task.title} ${task.description}`.toLowerCase().includes(query);
    });
    $("#taskList").innerHTML = filtered.length ? filtered.map(task => `
      <div class="task-row ${task.done ? "completed" : ""}">
        <input class="task-check" type="checkbox" data-task-check="${task.id}" ${task.done ? "checked" : ""} aria-label="تغيير حالة المهمة">
        <div class="task-info"><strong>${escapeHTML(task.title)}</strong><p>${escapeHTML(task.description || "بدون تفاصيل")} · ${dateLabel(task.due)}</p></div>
        <span class="priority ${task.priority}">${task.priority === "high" ? "عالية" : task.priority === "low" ? "منخفضة" : "متوسطة"}</span>
        <div class="row-actions"><button data-edit-task="${task.id}" title="تعديل">✎</button><button data-delete-task="${task.id}" title="حذف">×</button></div>
      </div>`).join("") : emptyState("✓", "لا توجد مهام هنا", "أضف مهمة جديدة وابدأ الإنجاز.");
  }

  function renderNotes() {
    const query = $("#noteSearch").value.trim().toLowerCase();
    const notes = data.notes.filter(note => `${note.title} ${note.content}`.toLowerCase().includes(query));
    $("#noteGrid").innerHTML = notes.length ? notes.map(note => `
      <article class="note-card"><h3>${escapeHTML(note.title)}</h3><p>${escapeHTML(note.content)}</p>
      <div class="note-footer"><span>${new Date(note.updatedAt).toLocaleDateString("ar-EG")}</span>
      <div class="note-actions"><button data-edit-note="${note.id}">تعديل</button><button data-delete-note="${note.id}">حذف</button></div></div></article>`).join("") : emptyState("▤", "لسه مفيش ملاحظات", "احتفظ بأفكارك المهمة في مكان واحد.");
  }

  const categoryInfo = {
    food: ["🍽️", "طعام"], transport: ["🚕", "مواصلات"], shopping: ["🛍️", "تسوق"],
    bills: ["🧾", "فواتير"], health: ["💊", "صحة"], other: ["◈", "أخرى"]
  };

  function renderBudget() {
    const month = today().slice(0, 7);
    const expenses = data.expenses.filter(item => item.date?.startsWith(month));
    const total = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
    $("#budgetTotal").textContent = money(total);
    $("#budgetCount").textContent = expenses.length.toLocaleString("ar-EG");
    $("#budgetAverage").textContent = money(expenses.length ? total / expenses.length : 0);
    $("#expenseList").innerHTML = data.expenses.length ? data.expenses.map(item => {
      const [emoji, category] = categoryInfo[item.category] || categoryInfo.other;
      return `<div class="expense-item"><div class="expense-icon">${emoji}</div><div class="expense-meta"><strong>${escapeHTML(item.title)}</strong><small>${category} · ${dateLabel(item.date)}</small></div><strong class="expense-amount">${money(item.amount)}</strong><button data-delete-expense="${item.id}" title="حذف">×</button></div>`;
    }).join("") : emptyState("◈", "لا توجد مصروفات مسجلة", "سجل أول مصروف لمتابعة ميزانيتك.");
  }

  function renderHabits() {
    const count = data.habits.length;
    const completed = data.habits.filter(habit => habit.done && habit.date === today()).length;
    const percent = count ? Math.round(completed / count * 100) : 0;
    $("#habitProgressText").textContent = `${percent.toLocaleString("ar-EG")}%`;
    $("#habitProgressBar").style.width = `${percent}%`;
    $("#habitList").innerHTML = data.habits.length ? data.habits.map(habit => {
      const checked = habit.done && habit.date === today();
      return `<article class="habit-card"><div class="habit-card-top"><span class="habit-emoji">${escapeHTML(habit.emoji)}</span><button class="row-actions" data-delete-habit="${habit.id}" title="حذف">×</button></div><h3>${escapeHTML(habit.title)}</h3><p>${escapeHTML(habit.description || "عادة يومية")}</p><button class="habit-done ${checked ? "checked" : ""}" data-toggle-habit="${habit.id}">${checked ? "✓ تم إنجازها اليوم" : "علّمها كمكتملة"}</button></article>`;
    }).join("") : emptyState("✦", "أضف أول عادة", "ابدأ بخطوة بسيطة تقدر تكررها كل يوم.");
  }

  function renderAll() {
    $("#profileName").textContent = data.profile.name || "صديقي";
    $(".avatar").textContent = (data.profile.name || "م")[0];
    document.body.classList.toggle("dark", data.theme === "dark");
    renderOverview();
    renderTasks();
    renderNotes();
    renderBudget();
    renderHabits();
  }

  function navigate(view) {
    $$(".view").forEach(section => section.classList.toggle("active", section.id === `view-${view}`));
    $$(".nav-link[data-view]").forEach(link => link.classList.toggle("active", link.dataset.view === view));
    const titles = { overview: "مساحة يومك", tasks: "المهام", notes: "الملاحظات", budget: "المصروفات", habits: "العادات", focus: "جلسة تركيز", settings: "الإعدادات" };
    $("#pageTitle").textContent = titles[view] || "نبتة";
    $("#sidebar").classList.remove("open");
  }

  function bindNavigation() {
    $$(".nav-link[data-view]").forEach(link => link.addEventListener("click", () => navigate(link.dataset.view)));
    $$("[data-goto]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.goto)));
    $("#menuToggle").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
    $("#quickAdd").addEventListener("click", () => openTaskModal());
  }

  function bindModal() {
    $("#modalClose").addEventListener("click", closeModal);
    $("#modalCancel").addEventListener("click", closeModal);
    $("#modalBackdrop").addEventListener("click", event => {
      if (event.target === $("#modalBackdrop")) closeModal();
    });
    $("#modalForm").addEventListener("submit", event => {
      event.preventDefault();
      if (!modalSubmit) return;
      const values = Object.fromEntries(new FormData(event.currentTarget).entries());
      modalSubmit(values);
      closeModal();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeModal();
    });
  }

  function bindTaskEvents() {
    $("#addTask").addEventListener("click", () => openTaskModal());
    $("#taskFilters").addEventListener("click", event => {
      const button = event.target.closest("[data-filter]");
      if (!button) return;
      taskFilter = button.dataset.filter;
      $$(".tab", $("#taskFilters")).forEach(tab => tab.classList.toggle("active", tab === button));
      renderTasks();
    });
    $("#taskSearch").addEventListener("input", renderTasks);
    document.addEventListener("change", event => {
      const id = event.target.dataset.taskCheck;
      if (!id) return;
      const task = data.tasks.find(item => item.id === id);
      if (task) {
        task.done = event.target.checked;
        saveData();
        toast(task.done ? "أحسنت! مهمة اكتملت 🎉" : "تم تحديث المهمة");
      }
    });
    $("#taskList").addEventListener("click", event => {
      const editId = event.target.dataset.editTask;
      const deleteId = event.target.dataset.deleteTask;
      if (editId) openTaskModal(data.tasks.find(item => item.id === editId));
      if (deleteId && confirm("هل تريد حذف هذه المهمة؟")) {
        data.tasks = data.tasks.filter(item => item.id !== deleteId);
        saveData();
        toast("تم حذف المهمة");
      }
    });
    $("#overviewTasks").addEventListener("change", event => {
      const id = event.target.dataset.taskCheck;
      const task = data.tasks.find(item => item.id === id);
      if (task) { task.done = event.target.checked; saveData(); }
    });
  }

  function bindNoteEvents() {
    $("#addNote").addEventListener("click", () => openNoteModal());
    $("#noteSearch").addEventListener("input", renderNotes);
    $("#noteGrid").addEventListener("click", event => {
      const editId = event.target.dataset.editNote;
      const deleteId = event.target.dataset.deleteNote;
      if (editId) openNoteModal(data.notes.find(item => item.id === editId));
      if (deleteId && confirm("هل تريد حذف الملاحظة؟")) {
        data.notes = data.notes.filter(note => note.id !== deleteId);
        saveData();
        toast("تم حذف الملاحظة");
      }
    });
  }

  function bindBudgetEvents() {
    $("#addExpense").addEventListener("click", openExpenseModal);
    $("#expenseList").addEventListener("click", event => {
      const id = event.target.dataset.deleteExpense;
      if (!id || !confirm("حذف هذا المصروف؟")) return;
      data.expenses = data.expenses.filter(item => item.id !== id);
      saveData();
      toast("تم حذف المصروف");
    });
  }

  function bindHabitEvents() {
    $("#addHabit").addEventListener("click", openHabitModal);
    $("#habitList").addEventListener("click", event => {
      const toggleId = event.target.dataset.toggleHabit;
      const deleteId = event.target.dataset.deleteHabit;
      if (toggleId) {
        const habit = data.habits.find(item => item.id === toggleId);
        if (habit) {
          habit.done = !(habit.done && habit.date === today());
          habit.date = today();
          saveData();
          toast(habit.done ? "رائع! استمر 🌟" : "تم إلغاء الإنجاز");
        }
      }
      if (deleteId && confirm("حذف هذه العادة؟")) {
        data.habits = data.habits.filter(item => item.id !== deleteId);
        saveData();
      }
    });
  }

  function bindProfileAndTheme() {
    $("#editProfile").addEventListener("click", () => {
      showModal("تعديل الاسم", field("اسمك", "name", "text", data.profile.name, 'required maxlength="30"'), values => {
        data.profile.name = values.name.trim() || "صديقي";
        saveData();
        toast("تم تحديث الاسم");
      });
    });
    $("#themeToggle").addEventListener("click", () => {
      data.theme = data.theme === "dark" ? "light" : "dark";
      saveData();
      toast(data.theme === "dark" ? "تم تفعيل الوضع الداكن" : "تم تفعيل الوضع الفاتح");
    });
  }

  function bindSettings() {
    $("#exportData").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `nabta-backup-${today()}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast("تم تجهيز النسخة الاحتياطية");
    });
    $("#importData").addEventListener("change", async event => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        const imported = JSON.parse(await file.text());
        if (!imported || typeof imported !== "object" || !Array.isArray(imported.tasks) || !Array.isArray(imported.notes)) {
          throw new Error("invalid backup");
        }
        data = { ...structuredClone(initialData), ...imported };
        saveData();
        toast("تم استيراد بياناتك بنجاح");
      } catch (error) {
        toast("الملف غير صالح أو ليس نسخة من نبتة");
      }
      event.target.value = "";
    });
    $("#clearData").addEventListener("click", () => {
      if (!confirm("سيتم حذف كل بياناتك من هذا الجهاز. هل أنت متأكد؟")) return;
      data = structuredClone(initialData);
      saveData();
      toast("تمت إعادة ضبط التطبيق");
      navigate("overview");
    });
  }

  const quotes = [
    "ابدأ بما تستطيع، ومن حيث أنت.",
    "الاستمرارية أقوى من الحماس المؤقت.",
    "كل إنجاز كبير بدأ بخطوة صغيرة.",
    "لا تقارن بدايتك بمنتصف طريق شخص آخر.",
    "خصص وقتاً لما يجعل حياتك أفضل."
  ];

  function bindQuotes() {
    $("#newQuote").addEventListener("click", () => {
      const current = $("#dailyQuote").textContent;
      const options = quotes.filter(quote => quote !== current);
      $("#dailyQuote").textContent = options[Math.floor(Math.random() * options.length)];
    });
  }

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
    const rest = (seconds % 60).toString().padStart(2, "0");
    return `${minutes}:${rest}`;
  }

  function updateTimer() {
    $("#timerDisplay").textContent = formatTime(timer.remaining);
    const progress = 1 - timer.remaining / timer.duration;
    $(".timer-ring").style.background = `conic-gradient(var(--primary) ${progress * 360}deg, var(--line) 0deg)`;
    $("#timerStatus").textContent = timer.running ? "أنت في وضع التركيز" : timer.remaining === 0 ? "أحسنت! انتهت الجلسة" : "جاهز للتركيز";
    $("#timerStart").textContent = timer.running ? "إيقاف مؤقت" : timer.remaining === 0 ? "ابدأ من جديد" : "ابدأ";
  }

  function stopTimer() {
    if (timer.interval) clearInterval(timer.interval);
    timer.interval = null;
    timer.running = false;
  }

  function bindTimer() {
    $$(".preset").forEach(button => button.addEventListener("click", () => {
      stopTimer();
      timer.duration = Number(button.dataset.minutes) * 60;
      timer.remaining = timer.duration;
      $$(".preset").forEach(preset => preset.classList.toggle("active", preset === button));
      updateTimer();
    }));
    $("#timerStart").addEventListener("click", () => {
      if (timer.running) {
        stopTimer();
        updateTimer();
        return;
      }
      if (timer.remaining === 0) timer.remaining = timer.duration;
      timer.running = true;
      timer.interval = setInterval(() => {
        timer.remaining -= 1;
        if (timer.remaining <= 0) {
          timer.remaining = 0;
          stopTimer();
          toast("انتهت جلسة التركيز! خد استراحة 👏");
        }
        updateTimer();
      }, 1000);
      updateTimer();
    });
    $("#timerReset").addEventListener("click", () => {
      stopTimer();
      timer.remaining = timer.duration;
      updateTimer();
    });
    updateTimer();
  }

  function setDateLabel() {
    const now = new Date();
    $("#todayLabel").textContent = now.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" });
    const hour = now.getHours();
    $("#pageTitle").textContent = hour < 12 ? "صباح الخير ✨" : hour < 18 ? "يوم جميل ليك ☀️" : "مساء الخير 🌙";
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("sw.js").catch(error => console.info("Service worker unavailable", error));
    }
  }

  function init() {
    setDateLabel();
    bindNavigation();
    bindModal();
    bindTaskEvents();
    bindNoteEvents();
    bindBudgetEvents();
    bindHabitEvents();
    bindProfileAndTheme();
    bindSettings();
    bindQuotes();
    bindTimer();
    renderAll();
    registerServiceWorker();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
