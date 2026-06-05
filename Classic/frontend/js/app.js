const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const today = new Date();
const baseStorageKey = "trading-journal-v1";
const marketKey = "trading-journal-market";
const themeKey = "trading-journal-theme";
const currencyKey = "trading-journal-currency";
const CURRENCIES = {
    INR: { symbol: "\u20B9", locale: "en-IN", code: "INR" },
    USD: { symbol: "$", locale: "en-US", code: "USD" },
    EUR: { symbol: "\u20AC", locale: "de-DE", code: "EUR" },
    GBP: { symbol: "\u00A3", locale: "en-GB", code: "GBP" },
    JPY: { symbol: "\u00A5", locale: "ja-JP", code: "JPY" },
    CAD: { symbol: "CA$", locale: "en-CA", code: "CAD" },
    AUD: { symbol: "A$", locale: "en-AU", code: "AUD" },
    CHF: { symbol: "Fr", locale: "de-CH", code: "CHF" },
    SGD: { symbol: "S$", locale: "en-SG", code: "SGD" },
    HKD: { symbol: "HK$", locale: "en-HK", code: "HKD" },
    AED: { symbol: "AED ", locale: "ar-AE", code: "AED" },
    CNY: { symbol: "\u00A5", locale: "zh-CN", code: "CNY" },
};
const MARKET_TYPES = {
    equity: "Equity",
    fno: "F&O",
    commodity: "Commodity",

    forex: "Forex",

};
let activeCurrency = CURRENCIES[localStorage.getItem(currencyKey)] || CURRENCIES.INR;
let currentYear = today.getFullYear();
let selectedDate = null;
let view = "monthly";
let selectedMonth = "all";
let activeMarket = localStorage.getItem(marketKey) || "equity";
let currentUser = null;
let store = loadStore();
let remoteSaveTimer = null;
let remoteSyncInProgress = false;

const els = {
    titleYear: document.getElementById("titleYear"),
    yearLabel: document.getElementById("yearLabel"),
    months: document.getElementById("months"),
    yearView: document.getElementById("yearView"),
    monthlyBtn: document.getElementById("monthlyBtn"),
    yearlyBtn: document.getElementById("yearlyBtn"),
    modal: document.getElementById("modal"),
    editorTitle: document.getElementById("editorTitle"),
    statusInput: document.getElementById("statusInput"),
    pnlInput: document.getElementById("pnlInput"),
    tradesInput: document.getElementById("tradesInput"),
    winsInput: document.getElementById("winsInput"),
    notesInput: document.getElementById("notesInput"),
    checkedInInput: document.getElementById("checkedInInput"),
    riskPctInput: document.getElementById("riskPctInput"),
    setupInput: document.getElementById("setupInput"),
    emotionChips: document.getElementById("emotionChips"),
    mistakeChips: document.getElementById("mistakeChips"),
    advancedFields: document.getElementById("advancedFields"),
    modeQuick: document.getElementById("modeQuick"),
    modeAdvanced: document.getElementById("modeAdvanced"),
    quickTradesInput: document.getElementById("quickTradesInput"),
    quickWinsInput: document.getElementById("quickWinsInput"),
};

let editorMode = "quick";

els.modeQuick.addEventListener("click", () => setEditorMode("quick"));
els.modeAdvanced.addEventListener("click", () => setEditorMode("advanced"));
document.getElementById("prevYear").addEventListener("click", () => { currentYear--; render(); });
document.getElementById("nextYear").addEventListener("click", () => { currentYear++; render(); });
document.getElementById("thisYear").addEventListener("click", () => { currentYear = today.getFullYear(); render(); });
document.getElementById("monthFilter").addEventListener("change", event => { selectedMonth = event.target.value; render(); });
document.getElementById("themeSelect").addEventListener("change", event => {
    applyTheme(event.target.value, document.getElementById("colorSelect").value);
    localStorage.setItem(themeKey, event.target.value);
});
document.getElementById("colorSelect").addEventListener("change", event => {
    applyTheme(document.getElementById("themeSelect").value, event.target.value);
    localStorage.setItem("trading-journal-color", event.target.value);
});
document.getElementById("capitalInput").addEventListener("input", event => {
    setCapital(currentYear, Number(event.target.value || 0));
    syncCapitalInputs(event.target.value);
    renderStats();
});
document.addEventListener("input", event => {
    if (event.target.id === "stripCapitalInput" || event.target.id === "ytbCapitalInput") {
        setCapital(currentYear, Number(event.target.value || 0));
        syncCapitalInputs(event.target.value);
        renderStats();
    }
});
document.getElementById("monthlyBtn").addEventListener("click", () => { view = "monthly"; render(); });
document.getElementById("yearlyBtn").addEventListener("click", () => { view = "yearly"; render(); });
document.getElementById("closeModal").addEventListener("click", closeEditor);
document.getElementById("clearDay").addEventListener("click", clearSelectedDay);
document.getElementById("editor").addEventListener("submit", saveSelectedDay);
document.getElementById("exportBtn").addEventListener("click", exportData);
document.getElementById("importBtn").addEventListener("click", () => document.getElementById("importFile").click());
document.getElementById("importFile").addEventListener("change", importData);
document.getElementById("ytbExportBtn").addEventListener("click", exportData);
document.getElementById("ytbImportBtn").addEventListener("click", () => document.getElementById("ytbImportFile").click());
document.getElementById("ytbImportFile").addEventListener("change", importData);
document.getElementById("currencySelect").addEventListener("change", event => {
    activeCurrency = CURRENCIES[event.target.value] || CURRENCIES.INR;
    localStorage.setItem(currencyKey, event.target.value);
    render();
});
document.getElementById("marketSelect").addEventListener("change", event => {
    activeMarket = event.target.value;
    localStorage.setItem(marketKey, activeMarket);
    store = loadStore();
    render();
    syncRemoteStore();
});
els.modal.addEventListener("click", event => {
    if (event.target === els.modal) closeEditor();
});

function storageKeyForMarket(market) {
    const userPart = currentUser ? `user-${currentUser.id}` : "guest";
    return `${baseStorageKey}-${userPart}-${market}`;
}

function loadStore() {
    try {
        const currentKey = storageKeyForMarket(activeMarket);
        const currentData = localStorage.getItem(currentKey);

        if (currentData) {
            return JSON.parse(currentData) || {};
        }

        if (!currentUser && activeMarket === "equity") {
            const legacyData = localStorage.getItem(baseStorageKey);

            if (legacyData) {
                const parsed = JSON.parse(legacyData) || {};
                localStorage.setItem(currentKey, JSON.stringify(parsed));
                return parsed;
            }
        }

        return {};
    } catch {
        return {};
    }
}

function applyTheme(mode, color) {
    const colorThemes = ["emerald", "sapphire", "violet", "graphite", "gold"];
    document.body.classList.remove("theme-light", ...colorThemes.map(n => `theme-${n}`));
    if (mode === "light") document.body.classList.add("theme-light");
    if (color) document.body.classList.add(`theme-${color}`);
    document.getElementById("themeSelect").value = mode || "default";
    document.getElementById("colorSelect").value = color || "";
}

function saveStore() {
    localStorage.setItem(storageKeyForMarket(activeMarket), JSON.stringify(store));
    queueRemoteSave();
}

function writeLocalStore(data) {
    store = data && typeof data === "object" ? data : {};
    localStorage.setItem(storageKeyForMarket(activeMarket), JSON.stringify(store));
}

function setSyncMessage(message, isError = false) {
    authEls.statuses.forEach(status => {
        if (!currentUser) return;
        status.textContent = message || currentUser.email;
        status.classList.toggle("sync-error", isError);
    });
}

function queueRemoteSave() {
    if (!currentUser || remoteSyncInProgress) return;
    clearTimeout(remoteSaveTimer);
    remoteSaveTimer = setTimeout(() => {
        saveRemoteStore().catch(error => {
            console.warn("Supabase save failed:", error);
            setSyncMessage("Sync failed", true);
        });
    }, 700);
}

async function saveRemoteStore() {
    if (!currentUser) return;

    setSyncMessage("Saving...");
    const { error } = await supabaseClient
        .from("journal_stores")
        .upsert({
            user_id: currentUser.id,
            market: activeMarket,
            data: store,
            updated_at: new Date().toISOString(),
        }, {
            onConflict: "user_id,market",
        });

    if (error) throw error;
    setSyncMessage("Synced");
    setTimeout(() => {
        if (currentUser) setSyncMessage(currentUser.email);
    }, 1200);
}

async function loadRemoteStore() {
    if (!currentUser) return {};

    const { data, error } = await supabaseClient
        .from("journal_stores")
        .select("data")
        .eq("user_id", currentUser.id)
        .eq("market", activeMarket)
        .maybeSingle();

    if (error) throw error;
    return data && data.data && typeof data.data === "object" ? data.data : {};
}

async function syncRemoteStore() {
    if (!currentUser || remoteSyncInProgress) return;

    remoteSyncInProgress = true;
    clearTimeout(remoteSaveTimer);
    setSyncMessage("Syncing...");

    try {
        const remoteStore = await loadRemoteStore();
        writeLocalStore(remoteStore);
        render();
        setSyncMessage("Synced");
        setTimeout(() => {
            if (currentUser) setSyncMessage(currentUser.email);
        }, 1200);
    } catch (error) {
        console.warn("Supabase sync failed:", error);
        setSyncMessage("Sync failed", true);
    } finally {
        remoteSyncInProgress = false;
    }
}

function syncCapitalInputs(value) {
    ["capitalInput", "stripCapitalInput", "ytbCapitalInput"].forEach(id => {
        const input = document.getElementById(id);
        if (input && input.value !== String(value || "")) input.value = value || "";
    });
}

function setEditorMode(mode) {
    editorMode = mode;
    els.modeQuick.classList.toggle("active", mode === "quick");
    els.modeAdvanced.classList.toggle("active", mode === "advanced");
    els.advancedFields.classList.toggle("show", mode === "advanced");
}

function getCapital(year) {
    return Number((store.__capital || {})[year] || 0);
}

function setCapital(year, value) {
    store.__capital = store.__capital || {};
    store.__capital[year] = Math.max(0, Number(value || 0));
    saveStore();
}

function keyFor(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function entryFor(key) {
    return store[key] || { status: "none", pnl: 0, trades: 0, wins: 0, notes: "" };
}

function render() {
    els.titleYear.textContent = currentYear;
    document.querySelectorAll(".mobileTitleYear").forEach(el => el.textContent = currentYear);
    els.yearLabel.textContent = currentYear;
    document.getElementById("monthFilter").value = selectedMonth;
    syncCapitalInputs(getCapital(currentYear) || "");
    document.getElementById("pnlMetricLabel").textContent = selectedMonth === "all" ? "Yearly P&L" : `${shortMonths[Number(selectedMonth)]} P&L`;
    document.getElementById("summaryTitle").textContent = selectedMonth === "all" ? "Yearly Summary" : `${monthNames[Number(selectedMonth)]} Summary`;
    els.monthlyBtn.classList.toggle("active", view === "monthly");
    els.yearlyBtn.classList.toggle("active", view === "yearly");
    els.months.classList.toggle("single-month", selectedMonth !== "all");
    els.months.closest(".content").classList.toggle("single-month-content", selectedMonth !== "all");
    els.months.style.display = view === "monthly" ? "grid" : "none";
    els.yearView.style.display = view === "yearly" ? "block" : "none";
    document.getElementById("singleMonthStrip").classList.toggle("visible", selectedMonth !== "all" && view === "monthly");
    document.getElementById("yearToolbar").classList.toggle("hidden", selectedMonth !== "all" || view !== "monthly");
    renderMonths();
    renderYearTable();
    renderStats();
}

function renderMonths() {
    els.months.innerHTML = "";
    els.months.classList.toggle("single-month", selectedMonth !== "all");
    monthNames.forEach((name, month) => {
        if (selectedMonth !== "all" && month !== Number(selectedMonth)) return;
        const stats = monthStats(month);
        const card = document.createElement("article");
        card.className = "month";
        if (currentYear === today.getFullYear() && month === today.getMonth()) card.classList.add("current");

        if (selectedMonth === "all") {
            const title = document.createElement("h2");
            title.textContent = name;
            card.append(title);
        } else {
            const head = document.createElement("div");
            head.className = "month-head";
            head.innerHTML = `<button class="icon-btn" type="button" id="prevMonth" aria-label="Previous month">&#9664;</button><h2>${name} ${currentYear}</h2><button class="icon-btn" type="button" id="nextMonth" aria-label="Next month">&#9654;</button><div class="month-stats-pill"><span>Monthly stats:</span><strong class="${stats.pnl < 0 ? "loss-text" : stats.pnl > 0 ? "profit-text" : ""}">${formatCompactMoney(stats.pnl)}</strong><span>${activeDays(monthEntries(month))} days</span></div>`;
            card.append(head);
        }

        const weekdaysEl = document.createElement("div");
        weekdaysEl.className = "weekdays";
        weekdays.forEach(day => {
            const span = document.createElement("span");
            span.textContent = day;
            weekdaysEl.append(span);
        });
        card.append(weekdaysEl);

        const days = document.createElement("div");
        days.className = "days";
        const first = new Date(currentYear, month, 1).getDay();
        const totalDays = new Date(currentYear, month + 1, 0).getDate();
        for (let i = 0; i < first; i++) {
            const empty = document.createElement("button");
            empty.className = "day empty";
            empty.type = "button";
            empty.innerHTML = `<span class="num"></span>`;
            days.append(empty);
        }
        for (let day = 1; day <= totalDays; day++) {
            days.append(renderDayButton(month, day));
        }
        card.append(days);

        if (selectedMonth === "all") {
            const footer = document.createElement("div");
            footer.className = "month-footer";
            footer.innerHTML = `<span>P&amp;L: <b class="${stats.pnl < 0 ? "loss-text" : "profit-text"}">${formatCompactMoney(stats.pnl)}</b></span><span>Trades: ${stats.trades}</span><span>Win Rate: ${formatPercent(stats.winRate)}</span>`;
            card.append(footer);
        }

        els.months.append(card);
        if (selectedMonth !== "all") {
            els.months.append(renderWeeklyPanel(month));
            document.getElementById("prevMonth").addEventListener("click", () => shiftSelectedMonth(-1));
            document.getElementById("nextMonth").addEventListener("click", () => shiftSelectedMonth(1));
        }
    });
}
function shiftSelectedMonth(delta) {
    let month = Number(selectedMonth);
    month += delta;
    if (month < 0) { month = 11; currentYear--; }
    if (month > 11) { month = 0; currentYear++; }
    selectedMonth = String(month);
    render();
}

function activeDays(entries) {
    return entries.filter(isLoggedDay).length;
}

function renderWeeklyPanel(month) {
    const panel = document.createElement("aside");
    panel.className = "weekly-panel";
    for (let week = 0; week < 6; week++) {
        const entries = weekEntries(month, week);
        const stats = statsFrom(entries);
        const card = document.createElement("div");
        card.className = "week-card";
        card.innerHTML = `<span>Week ${week + 1}</span><strong class="${stats.pnl < 0 ? "loss-text" : stats.pnl > 0 ? "profit-text" : ""}">${formatCompactMoney(stats.pnl)}</strong><small>${activeDays(entries)} days</small>`;
        panel.append(card);
    }
    return panel;
}

function weekEntries(month, week) {
    const first = new Date(currentYear, month, 1).getDay();
    return monthEntries(month).filter(entry => {
        const day = Number(entry.key.slice(-2));
        return Math.floor((first + day - 1) / 7) === week;
    });
}

function renderDayButton(month, day) {
    const key = keyFor(currentYear, month, day);
    const entry = entryFor(key);
    const tone = statusFor(entry);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `day ${tone}`;
    btn.title = `${monthNames[month]} ${day}: ${formatMoney(entry.pnl)}${entry.notes ? " - " + entry.notes : ""}`;
    btn.innerHTML = `<span class="num">${day}</span><span class="val ${tone === "loss" ? "loss-text" : tone === "profit" ? "profit-text" : ""}">${dayValue(entry)}</span><span class="day-meta">${entry.trades || 0} trades<br>${formatPercent(entry.trades ? (entry.wins || 0) / entry.trades : 0)}</span>`;
    btn.addEventListener("click", () => openEditor(key));
    return btn;
}

function dayValue(entry) {
    if (!entry || entry.status === "none") return "0";
    if (entry.status === "breakeven" || Number(entry.pnl) === 0) return "0";
    const pnl = statusFor(entry) === "loss" ? -Math.abs(Number(entry.pnl)) : Math.abs(Number(entry.pnl));
    return formatCompactMoney(pnl).replace(activeCurrency.symbol, "");
}

function statusFor(entry) {
    if (!entry || entry.status === "none") return "none";
    if (entry.status === "loss" || entry.status === "profit" || entry.status === "breakeven") return entry.status;
    if (Number(entry.pnl) > 0) return "profit";
    if (Number(entry.pnl) < 0) return "loss";
    return "breakeven";
}

function openEditor(key) {
    selectedDate = key;
    const entry = entryFor(key);
    const date = new Date(key + "T12:00:00");
    els.editorTitle.textContent = date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    els.statusInput.value = entry.status || statusFor(entry);
    els.pnlInput.value = entry.pnl ? Math.abs(Number(entry.pnl)) : "";
    els.quickTradesInput.value = entry.trades || "";
    els.quickWinsInput.value = entry.wins || "";
    els.tradesInput.value = entry.trades || "";
    els.winsInput.value = entry.wins || "";
    els.notesInput.value = entry.notes || "";
    els.checkedInInput.checked = !!entry.checkedIn;
    els.riskPctInput.value = entry.riskPct || "";
    els.setupInput.value = entry.setup || "";

    document.querySelectorAll('#quickEmotionChips input[type="radio"]').forEach(input => {
        const emotions = entry.emotions || [];
        input.checked = emotions.length === 1 && emotions[0] === input.value;
    });

    els.emotionChips.querySelectorAll("input").forEach(input => {
        input.checked = (entry.emotions || []).includes(input.value);
    });

    els.mistakeChips.querySelectorAll("input").forEach(input => {
        input.checked = (entry.mistakes || []).includes(input.value);
    });

    const hasAdvanced = entry.riskPct || entry.setup || (entry.mistakes || []).length || entry.notes;
    setEditorMode(hasAdvanced ? "advanced" : "quick");
    els.modal.classList.add("open");
    els.pnlInput.focus();
}

function closeEditor() {
    selectedDate = null;
    els.modal.classList.remove("open");
}

function saveSelectedDay(event) {
    event.preventDefault();
    if (!selectedDate) return;
    const chosenStatus = els.statusInput.value;
    let pnl = Number(els.pnlInput.value || 0);
    if (chosenStatus === "loss") pnl = -Math.abs(pnl);
    if (chosenStatus === "profit") pnl = Math.abs(pnl);
    if (chosenStatus === "breakeven") pnl = 0;
    let trades;
    let wins;
    let notes;
    let riskPct;
    let setup;
    let emotions;
    let mistakes;
    const existing = entryFor(selectedDate);

    if (editorMode === "quick") {
        const quickEmotion = document.querySelector('#quickEmotionChips input[type="radio"]:checked');
        trades = Math.max(0, Math.round(Number(els.quickTradesInput.value || existing.trades || 0)));
        wins = Math.min(trades, Math.max(0, Math.round(Number(els.quickWinsInput.value || existing.wins || 0))));
        notes = existing.notes || "";
        riskPct = Number(existing.riskPct || 0);
        setup = existing.setup || "";
        emotions = quickEmotion ? [quickEmotion.value] : (existing.emotions || []);
        mistakes = existing.mistakes || [];
    } else {
        trades = Math.max(0, Math.round(Number(els.tradesInput.value || 0)));
        wins = Math.min(trades, Math.max(0, Math.round(Number(els.winsInput.value || 0))));
        notes = els.notesInput.value.trim();
        riskPct = Number(els.riskPctInput.value || 0);
        setup = els.setupInput.value;
        emotions = [...els.emotionChips.querySelectorAll("input:checked")].map(input => input.value);
        mistakes = [...els.mistakeChips.querySelectorAll("input:checked")].map(input => input.value);
    }

    const status = chosenStatus === "none" && (pnl || trades) ? statusFor({ pnl }) : chosenStatus;
    store[selectedDate] = {
        status,
        pnl,
        trades,
        wins,
        notes,
        checkedIn: els.checkedInInput.checked,
        riskPct,
        setup,
        emotions,
        mistakes,
    }; saveStore();
    closeEditor();
    render();
}

function clearSelectedDay() {
    if (!selectedDate) return;
    delete store[selectedDate];
    saveStore();
    closeEditor();
    render();
}

function yearEntries() {
    return Object.entries(store)
        .filter(([key]) => key.startsWith(`${currentYear}-`))
        .map(([key, entry]) => ({ key, ...entry, pnl: Number(entry.pnl || 0), trades: Number(entry.trades || 0), wins: Number(entry.wins || 0) }));
}

function statsFrom(entries) {
    const active = entries.filter(isLoggedDay);
    const pnl = active.reduce((sum, entry) => sum + entry.pnl, 0);
    const trades = active.reduce((sum, entry) => sum + entry.trades, 0);
    const wins = active.reduce((sum, entry) => sum + entry.wins, 0);
    const losses = Math.max(0, trades - wins);
    const winningDays = active.filter(entry => entry.pnl > 0);
    const losingDays = active.filter(entry => entry.pnl < 0);
    const breakevenDays = active.filter(entry => entry.pnl === 0 && entry.status === "breakeven");
    const grossProfit = winningDays.reduce((sum, entry) => sum + entry.pnl, 0);
    const grossLoss = Math.abs(losingDays.reduce((sum, entry) => sum + entry.pnl, 0));
    return {
        pnl,
        trades,
        wins,
        losses,
        breakevens: breakevenDays.length,
        winRate: trades ? wins / trades : 0,
        best: winningDays.length ? winningDays.reduce((best, entry) => entry.pnl > best.pnl ? entry : best, winningDays[0]) : null,
        worst: losingDays.length ? losingDays.reduce((worst, entry) => entry.pnl < worst.pnl ? entry : worst, losingDays[0]) : null,
        average: trades ? pnl / trades : 0,
        profitFactor: grossLoss ? grossProfit / grossLoss : grossProfit ? Infinity : 0,
        expectancy: trades ? pnl / trades : 0,
        winningDays: winningDays.length,
        losingDays: losingDays.length
    };
}

function monthEntries(month) {
    const prefix = `${currentYear}-${String(month + 1).padStart(2, "0")}-`;
    return Object.entries(store)
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, entry]) => ({ key, ...entry, pnl: Number(entry.pnl || 0), trades: Number(entry.trades || 0), wins: Number(entry.wins || 0) }));
}

function monthStats(month) {
    return statsFrom(monthEntries(month));
}
function isLoggedDay(entry) {
    return !!entry && (
        entry.status !== "none" ||
        Number(entry.trades || 0) > 0 ||
        Number(entry.pnl || 0) !== 0 ||
        !!entry.checkedIn ||
        (entry.emotions || []).length > 0 ||
        (entry.mistakes || []).length > 0
    );
}

function disciplineScoreFor(entry) {
    if (!isLoggedDay(entry)) return null;

    const mistakes = entry.mistakes || [];
    const emotions = entry.emotions || [];
    const badEmotions = ["fomo", "revenge", "greedy", "frustrated", "distracted", "bored"];
    const goodEmotions = ["calm", "confident", "disciplined"];

    const hasEmotions = emotions.length > 0;
    const hasSetup = !!entry.setup;
    const hasRisk = Number(entry.riskPct || 0) > 0;
    const processFieldsFilled = [hasEmotions, hasSetup, hasRisk].filter(Boolean).length;
    const isIncomplete = processFieldsFilled < 2;

    let mistakeDeductions = 0;
    if (mistakes.includes("no-stoploss")) mistakeDeductions += 20;
    if (mistakes.includes("revenge-trade")) mistakeDeductions += 15;
    if (mistakes.includes("overtrading")) mistakeDeductions += 10;
    if (mistakes.includes("moved-sl")) mistakeDeductions += 10;
    if (mistakes.includes("oversized")) mistakeDeductions += 8;
    if (mistakes.includes("chased")) mistakeDeductions += 8;
    if (mistakes.includes("no-plan")) mistakeDeductions += 10;
    if (mistakes.includes("early-exit")) mistakeDeductions += 5;

    const pillar1 = isIncomplete ? 0 : Math.max(0, 40 - mistakeDeductions);

    let emotionScore = hasEmotions ? 12 : 0;
    goodEmotions.forEach(emotion => {
        if (emotions.includes(emotion)) emotionScore += 7;
    });
    badEmotions.forEach(emotion => {
        if (emotions.includes(emotion)) emotionScore -= 6;
    });
    const pillar2 = Math.max(0, Math.min(25, emotionScore));

    const setupScores = { "A+": 20, A: 17, B: 12, C: 6 };
    const pillar3 = hasSetup ? (setupScores[entry.setup] || 0) : 0;

    let pillar4 = 0;
    if (hasRisk) {
        const risk = Number(entry.riskPct);
        if (risk > 0 && risk <= 1) pillar4 = 15;
        else if (risk <= 2) pillar4 = 13;
        else if (risk <= 3) pillar4 = 8;
        else if (risk <= 5) pillar4 = 4;
    }

    return {
        total: Math.round(pillar1 + pillar2 + pillar3 + pillar4),
        incomplete: isIncomplete,
        pillars: [
            { label: "No Mistakes", value: pillar1, max: 40 },
            { label: "Mindset", value: pillar2, max: 25 },
            { label: "Setup Quality", value: pillar3, max: 20 },
            { label: "Risk Control", value: pillar4, max: 15 },
        ],
    };
}

function scoreColor(score) {
    if (score >= 80) return "var(--profit)";
    if (score >= 60) return "var(--accent-2)";
    if (score >= 40) return "var(--gold)";
    return "var(--loss)";
}

function scoreLabel(score) {
    if (score >= 85) return "Exceptional";
    if (score >= 70) return "Disciplined";
    if (score >= 55) return "Developing";
    if (score >= 40) return "Inconsistent";
    return "Struggling";
}

function renderDisciplineWidget() {
    const metric = document.getElementById("mDisciplineScore");
    const widget = document.getElementById("disciplineWidget");
    if (!metric || !widget) return;

    const scores = periodEntries()
        .filter(isLoggedDay)
        .map(disciplineScoreFor)
        .filter(score => score && !score.incomplete);

    if (!scores.length) {
        metric.textContent = "Incomplete";
        metric.style.color = "var(--muted)";
        widget.innerHTML = `<div class="score-empty">Add setup, risk, and emotions for at least one trade.</div>`;
        return;
    }

    const score = Math.round(scores.reduce((sum, item) => sum + item.total, 0) / scores.length);
    const color = scoreColor(score);

    metric.textContent = `${score}/100`;
    metric.style.color = color;

    widget.innerHTML = `
        <div class="score-main">
            <strong style="color:${color}">${score}</strong>
            <span>/100</span>
        </div>
        <div class="score-label" style="color:${color}">${scoreLabel(score)}</div>
        <p class="score-empty">Based on ${scores.length} complete trade day${scores.length === 1 ? "" : "s"}.</p>
    `;
}
function renderSetupAnalytics() {
    const el = document.getElementById("setupAnalytics");
    if (!el) return;

    const entries = periodEntries().filter(entry => entry.setup);

    if (!entries.length) {
        el.innerHTML = `<div class="score-empty">Add setup quality in trade details to see setup analytics.</div>`;
        return;
    }

    const grouped = {};

    entries.forEach(entry => {
        const setup = entry.setup || "Unknown";
        grouped[setup] = grouped[setup] || {
            pnl: 0,
            trades: 0,
            wins: 0,
            days: 0,
        };

        grouped[setup].pnl += Number(entry.pnl || 0);
        grouped[setup].trades += Number(entry.trades || 0);
        grouped[setup].wins += Number(entry.wins || 0);
        grouped[setup].days += 1;
    });

    const order = ["A+", "A", "B", "C"];

    el.innerHTML = order
        .filter(setup => grouped[setup])
        .map(setup => {
            const item = grouped[setup];
            const winRate = item.trades ? item.wins / item.trades : 0;
            const tone = item.pnl > 0 ? "profit-text" : item.pnl < 0 ? "loss-text" : "";

            return `
                <div class="setup-row">
                    <strong>${setup}</strong>
                    <span class="${tone}">${formatMoney(item.pnl)}</span>
                    <small>${item.days} day${item.days === 1 ? "" : "s"} &middot; ${item.trades} trades &middot; ${formatPercent(winRate)}</small>
                </div>
            `;
        })
        .join("");
}
function labelForEmotion(emotion) {
    const labels = {
        calm: "Calm",
        confident: "Confident",
        fomo: "FOMO",
        revenge: "Revenge",
        greedy: "Greedy",
        fearful: "Fearful",
        bored: "Bored",
        frustrated: "Frustrated",
        distracted: "Distracted",
        disciplined: "Disciplined",
    };

    return labels[emotion] || emotion;
}

function renderCoachingInsights() {
    const el = document.getElementById("coachingInsights");
    if (!el) return;

    const entries = periodEntries().filter(isLoggedDay);

    if (!entries.length) {
        el.innerHTML = `<div class="score-empty">Log trades to unlock coaching insights.</div>`;
        return;
    }

    const insights = [];

    const badEmotions = ["fomo", "revenge", "greedy", "frustrated", "distracted", "bored", "fearful"];
    const emotionLosses = badEmotions
        .map(emotion => {
            const list = entries.filter(entry => (entry.emotions || []).includes(emotion));
            return {
                emotion,
                count: list.length,
                pnl: list.reduce((sum, entry) => sum + Number(entry.pnl || 0), 0),
            };
        })
        .filter(item => item.count && item.pnl < 0)
        .sort((a, b) => a.pnl - b.pnl);

    if (emotionLosses[0]) {
        insights.push(`<strong>${labelForEmotion(emotionLosses[0].emotion)}</strong> days are hurting P&L by ${formatCompactMoney(Math.abs(emotionLosses[0].pnl))}.`);
    }

    const setups = ["A+", "A", "B", "C"]
        .map(setup => {
            const list = entries.filter(entry => entry.setup === setup);
            return {
                setup,
                list,
                stats: statsFrom(list),
            };
        })
        .filter(item => item.list.length);

    const weakestSetup = setups
        .filter(item => item.stats.pnl < 0)
        .sort((a, b) => a.stats.pnl - b.stats.pnl)[0];

    const strongestSetup = setups
        .filter(item => item.stats.pnl > 0)
        .sort((a, b) => b.stats.pnl - a.stats.pnl)[0];

    if (weakestSetup) {
        insights.push(`<strong>${weakestSetup.setup}</strong> setups are dragging P&L by ${formatCompactMoney(Math.abs(weakestSetup.stats.pnl))}.`);
    }

    if (strongestSetup) {
        insights.push(`<strong>${strongestSetup.setup}</strong> setups are carrying results at ${formatCompactMoney(strongestSetup.stats.pnl)}.`);
    }

    const incompleteDays = entries
        .map(disciplineScoreFor)
        .filter(score => score && score.incomplete)
        .length;

    if (incompleteDays) {
        insights.push(`<strong>${incompleteDays}</strong> logged day${incompleteDays === 1 ? "" : "s"} need setup, risk, and emotion details for better analysis.`);
    }

    el.innerHTML = insights.slice(0, 3).map(insight => {
        return `<div class="insight-item">${insight}</div>`;
    }).join("") || `<div class="score-empty">Add emotions, setup quality, and risk to get sharper coaching.</div>`;
}

function renderStreakWidget() {
    const el = document.getElementById("streakWidget");
    if (!el) return;

    const logged = new Set(yearEntries().filter(isLoggedDay).map(entry => entry.key));
    const days = daysInYear(currentYear);
    const totalDays = days.reduce((sum, count) => sum + count, 0);
    const endDay = currentYear === today.getFullYear() ? dayOfYear(today) : totalDays;

    let current = 0;
    for (let ordinal = endDay; ordinal >= 1; ordinal--) {
        if (!logged.has(keyFromOrdinal(currentYear, ordinal, days))) break;
        current++;
    }

    let best = 0;
    let run = 0;
    for (let ordinal = 1; ordinal <= totalDays; ordinal++) {
        if (logged.has(keyFromOrdinal(currentYear, ordinal, days))) {
            run++;
            best = Math.max(best, run);
        } else {
            run = 0;
        }
    }

    el.innerHTML = `
        <div class="habit-grid">
            <div class="habit-stat"><strong>${current}</strong><span>Current Streak</span></div>
            <div class="habit-stat"><strong>${best}</strong><span>Best Streak</span></div>
        </div>
    `;
}

function renderWeeklyAudit() {
    const el = document.getElementById("weeklyAudit");
    if (!el) return;

    const month = selectedMonth === "all"
        ? (currentYear === today.getFullYear() ? today.getMonth() : 0)
        : Number(selectedMonth);
    const first = new Date(currentYear, month, 1).getDay();
    const entries = monthEntries(month).filter(isLoggedDay);

    if (!entries.length) {
        el.innerHTML = `<div class="score-empty">Log trades this month to see weekly audit cards.</div>`;
        return;
    }

    let html = `<div class="audit-month">${monthNames[month]} ${currentYear}</div>`;
    for (let week = 0; week < 6; week++) {
        const list = entries.filter(entry => {
            const day = Number(entry.key.slice(-2));
            return Math.floor((first + day - 1) / 7) === week;
        });
        if (!list.length) continue;

        const stats = statsFrom(list);
        const completeScores = list.map(disciplineScoreFor).filter(score => score && !score.incomplete);
        const score = completeScores.length
            ? Math.round(completeScores.reduce((sum, item) => sum + item.total, 0) / completeScores.length)
            : null;
        const tone = stats.pnl < 0 ? "loss-text" : stats.pnl > 0 ? "profit-text" : "";

        html += `
            <div class="week-audit-row">
                <strong>Week ${week + 1}</strong>
                <span>${list.length} day${list.length === 1 ? "" : "s"}</span>
                <strong class="${tone}">${formatCompactMoney(stats.pnl)}</strong>
                <span>Discipline</span>
                <strong>${score === null ? "-" : score}</strong>
            </div>
        `;
    }

    el.innerHTML = html;
}

function renderPsychInsights() {
    const el = document.getElementById("psychInsights");
    if (!el) return;

    const active = periodEntries().filter(isLoggedDay);
    const emotionLabels = {
        calm: "Calm",
        confident: "Confident",
        fomo: "FOMO",
        revenge: "Revenge",
        greedy: "Greedy",
        fearful: "Fearful",
        bored: "Bored",
        frustrated: "Frustrated",
        distracted: "Distracted",
        disciplined: "Disciplined",
    };
    const mistakeLabels = {
        overtrading: "Overtrading",
        "no-stoploss": "No Stop Loss",
        "moved-sl": "Moved SL",
        oversized: "Oversized",
        "early-exit": "Early Exit",
        chased: "Chased Entry",
        "no-plan": "No Plan",
        "revenge-trade": "Revenge Trade",
    };

    const emotionPnl = {};
    const mistakePnl = {};
    active.forEach(entry => {
        (entry.emotions || []).forEach(emotion => {
            emotionPnl[emotion] = (emotionPnl[emotion] || 0) + Number(entry.pnl || 0);
        });
        (entry.mistakes || []).forEach(mistake => {
            mistakePnl[mistake] = (mistakePnl[mistake] || 0) + Number(entry.pnl || 0);
        });
    });

    const sortedEmotions = Object.entries(emotionPnl).sort((a, b) => b[1] - a[1]);
    const sortedMistakes = Object.entries(mistakePnl).sort((a, b) => a[1] - b[1]);

    if (!sortedEmotions.length && !sortedMistakes.length) {
        el.innerHTML = `<div class="score-empty">Log emotions and mistakes to unlock Mind vs Money insights.</div>`;
        return;
    }

    const badEmotionKeys = ["fomo", "revenge", "greedy", "frustrated", "distracted", "bored", "fearful"];
    const goodEmotionKeys = ["calm", "confident", "disciplined"];
    const badDays = active.filter(entry => (entry.emotions || []).some(emotion => badEmotionKeys.includes(emotion)));
    const goodDays = active.filter(entry => {
        const emotions = entry.emotions || [];
        return emotions.some(emotion => goodEmotionKeys.includes(emotion)) &&
            !emotions.some(emotion => badEmotionKeys.includes(emotion));
    });
    const badPnl = badDays.reduce((sum, entry) => sum + Number(entry.pnl || 0), 0);
    const goodPnl = goodDays.reduce((sum, entry) => sum + Number(entry.pnl || 0), 0);
    const maxAbsEmotion = Math.max(1, ...sortedEmotions.map(([, pnl]) => Math.abs(pnl)));
    const maxAbsMistake = Math.max(1, ...sortedMistakes.map(([, pnl]) => Math.abs(pnl)));

    let html = `
        <div class="mvm-report">
            <div class="mvm-card bad">
                <h3>Undisciplined Days</h3>
                <strong>${badDays.length}</strong>
                <span class="loss-text">${formatCompactMoney(badPnl)}</span>
            </div>
            <div class="mvm-card good">
                <h3>Disciplined Days</h3>
                <strong>${goodDays.length}</strong>
                <span class="profit-text">${formatCompactMoney(goodPnl)}</span>
            </div>
        </div>
    `;

    if (badDays.length || goodDays.length) {
        const diff = goodPnl - badPnl;
        const message = diff >= 0
            ? `Disciplined days are ahead by <strong>${formatCompactMoney(Math.abs(diff))}</strong>.`
            : `Undisciplined days are costing <strong>${formatCompactMoney(Math.abs(diff))}</strong>.`;
        html += `<div class="mvm-insight-bar">${message}</div>`;
    }

    if (sortedEmotions.length) {
        html += `<h3 class="mini-heading">Emotion P&amp;L Impact</h3>`;
        sortedEmotions.slice(0, 6).forEach(([emotion, pnl]) => {
            const width = Math.max(4, Math.round(Math.abs(pnl) / maxAbsEmotion * 100));
            const tone = pnl < 0 ? "negative" : pnl > 0 ? "positive" : "";
            const label = emotionLabels[emotion] || escapeHtml(emotion);
            html += `<div class="emotion-bar-row ${tone}"><span>${label}</span><span class="ebar-track"><span class="ebar-fill" style="width:${width}%"></span></span><strong class="${pnl < 0 ? "loss-text" : "profit-text"}">${formatCompactMoney(pnl)}</strong></div>`;
        });
    }

    if (sortedMistakes.length) {
        html += `<h3 class="mini-heading">Costly Mistakes</h3>`;
        sortedMistakes.slice(0, 5).forEach(([mistake, pnl]) => {
            const width = Math.max(4, Math.round(Math.abs(pnl) / maxAbsMistake * 100));
            const label = mistakeLabels[mistake] || escapeHtml(mistake);
            html += `<div class="emotion-bar-row negative"><span>${label}</span><span class="ebar-track"><span class="ebar-fill" style="width:${width}%"></span></span><strong class="loss-text">${formatCompactMoney(pnl)}</strong></div>`;
        });
    }

    el.innerHTML = html;
}

function renderStats() {
    const stats = statsFrom(periodEntries());
    setMetric("mPnl", formatMoney(stats.pnl), stats.pnl);
    document.getElementById("mTrades").textContent = stats.trades.toLocaleString();
    document.getElementById("mWinRate").textContent = formatPercent(stats.winRate);
    setMetric("mBest", stats.best ? formatMoney(stats.best.pnl) : formatMoney(0), stats.best ? stats.best.pnl : 0);
    setMetric("mWorst", stats.worst ? formatMoney(stats.worst.pnl) : formatMoney(0), stats.worst ? stats.worst.pnl : 0);
    document.getElementById("mProfitFactor").textContent = formatFactor(stats.profitFactor);
    document.getElementById("mExpectancy").textContent = formatMoney(stats.expectancy);
    renderCapitalSummary(stats);
    renderSummary(stats);
    renderBars();
    renderOverview(stats);
    renderBestWorst(stats);
    renderDisciplineWidget();
    renderSetupAnalytics();
    renderCoachingInsights();
    renderStreakWidget();
    renderWeeklyAudit();
    renderPsychInsights();
    renderSingleMonthStrip(stats);
    renderYearToolbar(stats);
    drawEquityCurve();
}

function renderSingleMonthStrip(stats) {
    const strip = document.getElementById("singleMonthStrip");
    if (!strip || !strip.classList.contains("visible")) return;

    setPanelText("stripPnl", formatMoney(stats.pnl), stats.pnl);
    setPanelText("stripTrades", stats.trades.toLocaleString());
    setPanelText("stripWinRate", formatPercent(stats.winRate));
    setPanelText("stripWinDays", stats.winningDays.toLocaleString(), stats.winningDays);
    setPanelText("stripLossDays", stats.losingDays.toLocaleString(), -stats.losingDays);
    setPanelText("stripBest", stats.best ? formatMoney(stats.best.pnl) : formatMoney(0), stats.best ? stats.best.pnl : 0);
    setPanelText("stripWorst", stats.worst ? formatMoney(stats.worst.pnl) : formatMoney(0), stats.worst ? stats.worst.pnl : 0);
    setPanelText("stripAvgProfit", formatMoney(stats.average), stats.average);
    setPanelText("stripPF", formatFactor(stats.profitFactor));
}

function renderYearToolbar(stats) {
    const toolbar = document.getElementById("yearToolbar");
    if (!toolbar || toolbar.classList.contains("hidden")) return;

    setPanelText("ytbPnl", formatMoney(stats.pnl), stats.pnl);
    setPanelText("ytbWinRate", formatPercent(stats.winRate));
    setPanelText("ytbBest", stats.best ? formatMoney(stats.best.pnl) : formatMoney(0), stats.best ? stats.best.pnl : 0);
    setPanelText("ytbWorst", stats.worst ? formatMoney(stats.worst.pnl) : formatMoney(0), stats.worst ? stats.worst.pnl : 0);
    setPanelText("ytbPF", formatFactor(stats.profitFactor));

    const monthData = monthNames.map((_, month) => monthStats(month));
    const max = Math.max(1, ...monthData.map(stat => Math.abs(stat.pnl)));
    document.getElementById("ytbBarsGrid").innerHTML = monthData.map((stat, index) => {
        const height = Math.max(2, Math.round(Math.abs(stat.pnl) / max * 36));
        const color = stat.pnl > 0 ? "var(--profit)" : stat.pnl < 0 ? "var(--loss)" : "var(--none)";
        return `<div class="ytb-bar-col"><div class="ytb-bar-fill" style="height:${height}px;background:${color}" title="${shortMonths[index]}: ${formatCompactMoney(stat.pnl)}"></div><span>${shortMonths[index]}</span></div>`;
    }).join("");
}

function setPanelText(id, text, amount) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    if (amount !== undefined) {
        el.classList.toggle("profit-text", amount > 0);
        el.classList.toggle("loss-text", amount < 0);
    }
}

function periodEntries() {
    return selectedMonth === "all" ? yearEntries() : monthEntries(Number(selectedMonth));
}

function setMetric(id, text, amount) {
    const el = document.getElementById(id);
    el.textContent = text;
    el.classList.toggle("profit-text", amount > 0);
    el.classList.toggle("loss-text", amount < 0);
}

function renderSummary(stats) {
    const lines = [
        ["Total P&L", formatMoney(stats.pnl), stats.pnl],
        ["Total Trades", stats.trades.toLocaleString()],
        ["Win Rate", formatPercent(stats.winRate)],
        ["Winning Trades", stats.wins.toLocaleString()],
        ["Losing Trades", stats.losses.toLocaleString()],
        ["Breakeven Days", stats.breakevens.toLocaleString()],
        ["__divider"],
        ["Best Day", stats.best ? formatMoney(stats.best.pnl) : formatMoney(0), stats.best ? stats.best.pnl : 0],
        ["Worst Day", stats.worst ? formatMoney(stats.worst.pnl) : formatMoney(0), stats.worst ? stats.worst.pnl : 0],
        ["__divider"],
        ["Average Profit/Trade", formatMoney(stats.average), stats.average],
        ["Profit Factor", formatFactor(stats.profitFactor)],
        ["Expectancy", formatMoney(stats.expectancy), stats.expectancy]
    ];
    document.getElementById("summary").innerHTML = lines.map(row => {
        if (row[0] === "__divider") return `<div class="divider"></div>`;
        const tone = row[2] > 0 ? "profit-text" : row[2] < 0 ? "loss-text" : "";
        return `<div class="summary-row"><span>${row[0]}</span><strong class="${tone}">${row[1]}</strong></div>`;
    }).join("");
}

function renderCapitalSummary(stats) {
    const capital = getCapital(currentYear);
    const endingEquity = capital + stats.pnl;
    const returnPct = capital ? stats.pnl / capital : 0;
    const periodName = selectedMonth === "all" ? "Selected Year" : monthNames[Number(selectedMonth)];
    document.getElementById("capitalSummary").innerHTML = `
        <div class="summary-row"><span>${periodName} P&amp;L</span><strong class="${stats.pnl < 0 ? "loss-text" : stats.pnl > 0 ? "profit-text" : ""}">${formatMoney(stats.pnl)}</strong></div>
        <div class="summary-row"><span>Ending Equity</span><strong>${formatMoney(endingEquity)}</strong></div>
        <div class="summary-row"><span>Return on Capital</span><strong class="${returnPct < 0 ? "loss-text" : returnPct > 0 ? "profit-text" : ""}">${formatPercent(returnPct)}</strong></div>
      `;
}

function renderBars() {
    const monthData = monthNames.map((_, month) => monthStats(month));
    const max = Math.max(1, ...monthData.map(stat => Math.abs(stat.pnl)));
    document.getElementById("monthlyBars").innerHTML = monthData.map((stat, index) => {
        const width = Math.max(2, Math.round(Math.abs(stat.pnl) / max * 100));
        const tone = stat.pnl < 0 ? "loss-text" : "profit-text";
        const color = stat.pnl < 0 ? "var(--loss)" : "var(--profit)";
        return `<div class="bar-row"><span>${shortMonths[index]}</span><span class="bar-track"><span class="bar-fill" style="width:${width}%;background:${color}"></span></span><strong class="${tone}">${formatCompactMoney(stat.pnl)}</strong></div>`;
    }).join("");
}

function renderOverview(stats) {
    const items = [
        ["Total P&L", formatMoney(stats.pnl), stats.pnl],
        ["Win Rate", formatPercent(stats.winRate)],
        ["Profit Factor", formatFactor(stats.profitFactor)],
        ["Expectancy", formatMoney(stats.expectancy), stats.expectancy],
        ["Winning Trades", stats.wins.toLocaleString(), 1],
        ["Losing Trades", stats.losses.toLocaleString(), -1],
        ["Breakeven Days", stats.breakevens.toLocaleString()]
    ];
    document.getElementById("overview").innerHTML = items.map(([label, value, tone]) => {
        const cls = tone > 0 ? "profit-text" : tone < 0 ? "loss-text" : "";
        return `<div class="overview-item"><strong class="${cls}">${value}</strong><span>${label}</span></div>`;
    }).join("");
}

function renderBestWorst(stats) {
    const best = stats.best ? [formatDate(stats.best.key), formatMoney(stats.best.pnl)] : ["-", formatMoney(0)];
    const worst = stats.worst ? [formatDate(stats.worst.key), formatMoney(stats.worst.pnl)] : ["-", formatMoney(0)];
    document.getElementById("bestWorst").innerHTML = `
        <strong class="profit-text">Best Day</strong><span>${best[0]}</span><b class="profit-text">${best[1]}</b>
        <strong class="loss-text">Worst Day</strong><span>${worst[0]}</span><b class="loss-text">${worst[1]}</b>
      `;
}

function renderYearTable() {
    const rows = monthNames.map((name, month) => {
        const stats = monthStats(month);
        return `<tr><td>${name}</td><td class="${stats.pnl < 0 ? "loss-text" : "profit-text"}">${formatMoney(stats.pnl)}</td><td>${stats.trades}</td><td>${formatPercent(stats.winRate)}</td><td>${stats.wins}</td><td>${stats.losses}</td><td>${formatFactor(stats.profitFactor)}</td></tr>`;
    }).join("");

    const cards = monthNames.map((name, month) => {
        const stats = monthStats(month);
        const pnlClass = stats.pnl < 0 ? "loss-text" : stats.pnl > 0 ? "profit-text" : "";
        return `<div class="year-card">
          <div class="yc-month">${name.slice(0, 3)}</div>
          <div class="yc-pnl ${pnlClass}">${formatCompactMoney(stats.pnl)}</div>
          <div class="yc-stats">
            <div class="yc-row"><span>Trades</span><span>${stats.trades}</span></div>
            <div class="yc-row"><span>Win%</span><span>${formatPercent(stats.winRate)}</span></div>
            <div class="yc-row"><span>W/L</span><span>${stats.wins}/${stats.losses}</span></div>
            <div class="yc-row"><span>PF</span><span>${formatFactor(stats.profitFactor)}</span></div>
          </div>
        </div>`;
    }).join("");

    els.yearView.innerHTML = `
        <table class="year-table"><thead><tr><th>Month</th><th>P&amp;L</th><th>Trades</th><th>Win Rate</th><th>Wins</th><th>Losses</th><th>Profit Factor</th></tr></thead><tbody>${rows}</tbody></table>
        <div class="year-cards">${cards}</div>
      `;
}

function drawEquityCurve() {
    const canvas = document.getElementById("equityChart");
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Read theme colours from CSS variables at render time
    const styles = getComputedStyle(document.documentElement);
    const isLight = document.body.classList.contains('theme-light');
    const labelColor = isLight ? "#4a5568" : "#a6b4c6";
    const gridColor = isLight ? "rgba(100,130,170,.15)" : "rgba(174,185,200,.13)";
    const lineColor = isLight ? "#1a7f4b" : "#56d475";
    const fillColor = isLight ? "rgba(26,127,75,.07)" : "rgba(86,212,117,.08)";

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
        const y = 16 + i * ((height - 28) / 4);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
    const points = dailyEquityPoints();
    if (points.length < 2) return;
    const values = points.map(point => point.value);
    const min = Math.min(0, ...values);
    const max = Math.max(1, ...values);
    const pad = 10;
    ctx.beginPath();
    points.forEach((point, index) => {
        const x = pad + index / (points.length - 1) * (width - pad * 2);
        const y = height - pad - ((point.value - min) / (max - min || 1)) * (height - pad * 2);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.lineTo(width - pad, height - pad);
    ctx.lineTo(pad, height - pad);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.fillStyle = labelColor;
    ctx.font = "12px 'Outfit', Inter, sans-serif";
    shortMonths.forEach((month, index) => {
        const x = pad + index / 11 * (width - pad * 2);
        ctx.fillText(month, x - 10, height - 2);
    });
}

function dailyEquityPoints() {
    const points = [];
    let equity = 0;
    const end = new Date(currentYear, 11, 31);
    for (let date = new Date(currentYear, 0, 1); date <= end; date.setDate(date.getDate() + 1)) {
        const key = keyFor(date.getFullYear(), date.getMonth(), date.getDate());
        equity += Number((store[key] || {}).pnl || 0);
        points.push({ key, value: equity });
    }
    return points;
}

function exportData() {
    const exportPayload = {
        app: "my-trade-audit",
        version: 1,
        market: activeMarket,
        year: currentYear,
        exportedAt: new Date().toISOString(),
        data: Object.fromEntries(
            Object.entries(store).map(([key, entry]) => [
                key,
                key.startsWith("__")
                    ? entry
                    : {
                        status: entry.status || "none",
                        pnl: Number(entry.pnl || 0),
                        trades: Number(entry.trades || 0),
                        wins: Number(entry.wins || 0),
                        notes: entry.notes || "",
                        checkedIn: !!entry.checkedIn,
                        riskPct: Number(entry.riskPct || 0),
                        setup: entry.setup || "",
                        emotions: entry.emotions || [],
                        mistakes: entry.mistakes || [],
                    }
            ])
        ),
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `trading-journal-${activeMarket}-${currentYear}.json`;
    link.click();

    URL.revokeObjectURL(url);
    localStorage.setItem("trading-journal-last-export", Date.now());
    renderBackupReminder();
}

function renderBackupReminder() {
    const lastExport = Number(localStorage.getItem("trading-journal-last-export") || 0);
    const daysSince = lastExport ? Math.floor((Date.now() - lastExport) / 86400000) : null;
    const warnDays = 7;
    let className = "backup-reminder";
    let html = `<strong>No backup yet.</strong> Export your journal to keep a local copy safe.`;

    if (lastExport && daysSince < warnDays) {
        className = "backup-reminder ok";
        html = `<strong>Backed up</strong> ${daysSince === 0 ? "today" : `${daysSince}d ago`}.`;
    } else if (lastExport) {
        html = `<strong>Backup due.</strong> Last export was ${daysSince} days ago.`;
    }

    ["backupReminder", "ytbBackupReminder"].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.className = className;
        el.innerHTML = html;
    });
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
        try {
            const imported = JSON.parse(reader.result);
            const importedData = validateImportPayload(imported);

            store = { ...store, ...importedData };
            saveStore();
            render();
            alert(`Imported ${Object.keys(importedData).length} record${Object.keys(importedData).length === 1 ? "" : "s"} successfully.`);
        } catch {
            alert("That file could not be imported. Please choose a valid My Trade Audit backup file.");
        }
    };

    reader.readAsText(file);
    event.target.value = "";
}

function validateImportPayload(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("Invalid backup file.");
    }

    const isWrappedBackup = Object.prototype.hasOwnProperty.call(payload, "data");
    if (isWrappedBackup && payload.app && payload.app !== "my-trade-audit") {
        throw new Error("Wrong app backup.");
    }

    const rawData = isWrappedBackup ? payload.data : payload;
    if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
        throw new Error("Missing backup data.");
    }

    const normalized = {};
    Object.entries(rawData).forEach(([key, value]) => {
        if (key === "__capital") {
            normalized.__capital = normalizeCapital(value);
            return;
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
        const entry = normalizeTradeEntry(value);
        if (entry) normalized[key] = entry;
    });

    if (!Object.keys(normalized).length) {
        throw new Error("No valid journal records found.");
    }

    return normalized;
}

function normalizeCapital(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};

    return Object.fromEntries(
        Object.entries(value)
            .filter(([year]) => /^\d{4}$/.test(year))
            .map(([year, amount]) => [year, Math.max(0, Number(amount || 0))])
    );
}

function normalizeTradeEntry(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;

    const allowedStatuses = ["none", "profit", "loss", "breakeven"];
    const allowedSetups = ["", "A+", "A", "B", "C"];
    const allowedEmotions = ["calm", "confident", "fomo", "revenge", "greedy", "fearful", "bored", "frustrated", "distracted", "disciplined"];
    const allowedMistakes = ["overtrading", "no-stoploss", "moved-sl", "oversized", "early-exit", "chased", "no-plan", "revenge-trade"];

    let status = allowedStatuses.includes(value.status) ? value.status : "none";
    let pnl = Number(value.pnl || 0);
    if (!Number.isFinite(pnl)) pnl = 0;

    if (status === "profit") pnl = Math.abs(pnl);
    if (status === "loss") pnl = -Math.abs(pnl);
    if (status === "breakeven") pnl = 0;
    if (status === "none" && pnl > 0) status = "profit";
    if (status === "none" && pnl < 0) status = "loss";

    const trades = Math.max(0, Math.round(Number(value.trades || 0)));
    const wins = Math.min(trades, Math.max(0, Math.round(Number(value.wins || 0))));
    const setup = allowedSetups.includes(value.setup) ? value.setup : "";

    return {
        status,
        pnl,
        trades,
        wins,
        notes: String(value.notes || "").slice(0, 2000),
        checkedIn: !!value.checkedIn,
        riskPct: Math.max(0, Number(value.riskPct || 0)),
        setup,
        emotions: normalizeStringArray(value.emotions, allowedEmotions),
        mistakes: normalizeStringArray(value.mistakes, allowedMistakes),
    };
}

function normalizeStringArray(value, allowed) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter(item => allowed.includes(item)))];
}

function formatMoney(value) {
    const c = activeCurrency;
    const sign = value < 0 ? "-" : "";
    const abs = Math.abs(value);
    const noDecimals = ["JPY"].includes(c.code);

    return `${sign}${c.symbol}${abs.toLocaleString(c.locale, { maximumFractionDigits: noDecimals ? 0 : 2 })}`;
}

function formatCompactMoney(value) {
    const c = activeCurrency;
    const sign = value < 0 ? "-" : "";
    const abs = Math.abs(value);
    // Use Indian numbering (Lakh/Crore) only for INR
    if (c.code === "INR") {
        if (abs >= 10000000) return `${sign}${c.symbol}${(abs / 10000000).toFixed(2)}Cr`;
        if (abs >= 100000) return `${sign}${c.symbol}${(abs / 100000).toFixed(2)}L`;
        if (abs >= 1000) return `${sign}${c.symbol}${(abs / 1000).toFixed(abs >= 10000 ? 2 : 1)}K`;
        return `${sign}${c.symbol}${abs.toLocaleString(c.locale, { maximumFractionDigits: 0 })}`;
    }
    if (abs >= 1000000000) return `${sign}${c.symbol}${(abs / 1000000000).toFixed(2)}B`;
    if (abs >= 1000000) return `${sign}${c.symbol}${(abs / 1000000).toFixed(2)}M`;
    if (abs >= 1000) return `${sign}${c.symbol}${(abs / 1000).toFixed(abs >= 10000 ? 2 : 1)}K`;
    return `${sign}${c.symbol}${abs.toLocaleString(c.locale, { maximumFractionDigits: 0 })}`;
}

function formatPercent(value) {
    return `${(value * 100).toFixed(2)}%`;
}

function formatFactor(value) {
    return value === Infinity ? "\u221E" : value.toFixed(2);
}

function formatDate(key) {
    return new Date(key + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function daysInYear(year) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
}

function dayOfYear(date) {
    const days = daysInYear(date.getFullYear());
    let ordinal = date.getDate();
    for (let month = 0; month < date.getMonth(); month++) ordinal += days[month];
    return ordinal;
}

function keyFromOrdinal(year, ordinal, days) {
    let month = 0;
    while (ordinal > days[month]) {
        ordinal -= days[month];
        month++;
    }
    return keyFor(year, month, ordinal);
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

render();
applyTheme(localStorage.getItem(themeKey) || "default", localStorage.getItem("trading-journal-color") || "");
document.getElementById("currencySelect").value = activeCurrency.code;
document.getElementById("marketSelect").value = activeMarket;
renderBackupReminder();

function adjustMobileTopbar() {
    if (window.innerWidth <= 680) {
        const h = document.querySelector(".mobile-brand").offsetHeight;
        document.querySelector(".shell").style.marginTop = h + "px";
        // sync year into mobile brand
        document.querySelectorAll(".mobileTitleYear").forEach(el => el.textContent = currentYear);
    } else {
        document.querySelector(".shell").style.marginTop = "";
    }
}
adjustMobileTopbar();
window.addEventListener("resize", adjustMobileTopbar);
let authMode = "login";

const authEls = {
    modal: document.getElementById("authModal"),
    title: document.getElementById("authTitle"),
    form: document.getElementById("authForm"),
    email: document.getElementById("authEmail"),
    password: document.getElementById("authPassword"),
    submitBtn: document.getElementById("authSubmitBtn"),
    switchModeBtn: document.getElementById("authSwitchModeBtn"),
    forgotPasswordBtn: document.getElementById("forgotPasswordBtn"),
    message: document.getElementById("authMessage"),
    statuses: document.querySelectorAll(".authStatus"),
    openLoginBtns: document.querySelectorAll(".openLoginBtn"),
    openSignupBtns: document.querySelectorAll(".openSignupBtn"),
    logoutBtns: document.querySelectorAll(".logoutBtn"),
    closeBtn: document.getElementById("closeAuthModal"),
};

authEls.openLoginBtns.forEach(button => {
    button.addEventListener("click", () => openAuthModal("login"));
});

authEls.openSignupBtns.forEach(button => {
    button.addEventListener("click", () => openAuthModal("signup"));
});

authEls.logoutBtns.forEach(button => {
    button.addEventListener("click", handleLogout);
});

authEls.closeBtn.addEventListener("click", closeAuthModal);
authEls.form.addEventListener("submit", handleAuthSubmit);
authEls.switchModeBtn.addEventListener("click", () => {
    openAuthModal(authMode === "login" ? "signup" : "login");
});
authEls.forgotPasswordBtn.addEventListener("click", handlePasswordReset);

function openAuthModal(mode) {
    authMode = mode;
    authEls.title.textContent = mode === "login" ? "Login" : "Create Account";
    authEls.submitBtn.textContent = mode === "login" ? "Login" : "Sign Up";
    authEls.switchModeBtn.textContent = mode === "login" ? "Create account instead" : "Login instead";
    authEls.forgotPasswordBtn.style.display = mode === "login" ? "inline-block" : "none";
    authEls.message.textContent = "";
    authEls.modal.classList.add("open");
}

function closeAuthModal() {
    authEls.modal.classList.remove("open");
}

async function handleAuthSubmit(event) {
    event.preventDefault();

    const email = authEls.email.value.trim().toLowerCase();
    const password = authEls.password.value;

    authEls.message.textContent = "Please wait...";

    let result;

    if (authMode === "signup") {
        result = await supabaseClient.auth.signUp({
            email,
            password,
        });
    } else {
        result = await supabaseClient.auth.signInWithPassword({
            email,
            password,
        });
    }

    if (result.error) {
        authEls.message.textContent = authErrorMessage(result.error.message);
        return;
    }

    authEls.message.textContent =
        authMode === "signup"
            ? "Account created. Check your email if confirmation is enabled."
            : "Logged in successfully.";

    await updateAuthUI();
    setTimeout(closeAuthModal, 700);
}

async function handlePasswordReset() {
    const email = authEls.email.value.trim().toLowerCase();
    if (!email) {
        authEls.message.textContent = "Enter your email first, then click Forgot password.";
        return;
    }

    authEls.message.textContent = "Sending password reset email...";
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
    });

    authEls.message.textContent = error
        ? authErrorMessage(error.message)
        : "Password reset email sent. Check your inbox.";
}

function authErrorMessage(message) {
    if (/invalid login credentials/i.test(message)) {
        return "Email or password does not match. Check the exact email, or create an account if this email is new.";
    }
    if (/email not confirmed/i.test(message)) {
        return "Email is not confirmed yet. Open the confirmation email from Supabase, then log in again.";
    }
    return message;
}

async function handleLogout() {
    await supabaseClient.auth.signOut();
    currentUser = null;
    store = loadStore();
    render();
    await updateAuthUI();
}

async function updateAuthUI() {
    let user = null;
    try {
        const result = await supabaseClient.auth.getUser();
        user = result.data.user || null;
    } catch (error) {
        console.warn("Could not read auth session:", error);
    }

    const previousUserId = currentUser && currentUser.id;
    currentUser = user || null;

    authEls.statuses.forEach(status => {
        status.textContent = user ? user.email : "Not signed in";
        status.classList.remove("sync-error");
    });

    authEls.openLoginBtns.forEach(button => {
        button.style.display = user ? "none" : "inline-block";
    });

    authEls.openSignupBtns.forEach(button => {
        button.style.display = user ? "none" : "inline-block";
    });

    authEls.logoutBtns.forEach(button => {
        button.style.display = user ? "inline-block" : "none";
    });

    if (user && user.id !== previousUserId) {
        await syncRemoteStore();
    }
}

supabaseClient.auth.onAuthStateChange((_event, session) => {
    const nextUser = session && session.user ? session.user : null;
    const changedUser = (currentUser && currentUser.id) !== (nextUser && nextUser.id);

    if (changedUser) {
        updateAuthUI();
    }
});

updateAuthUI();
