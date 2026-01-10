// ==========================================
// データ管理変数
// ==========================================

let allSchedules = {};     
let trashSchedules = [];   
let currentScheduleName = "";
let tasks = [];            
let appVersion = "v1.0"; // バージョン管理変数

// 編集中のタスク番号
let editingIndex = -1;

let amChart = null;
let pmChart = null;
let memos = [];

// ==========================================
// 初期化処理
// ==========================================
window.onload = function() {
    Chart.register(ChartDataLabels);

    loadAllData();
    loadMemos();
    loadVersion(); 
    cleanupTrash();

    renderScheduleSelector();
    updateUI(false);
    
    // メモのドラッグ＆ドロップ設定
    const memoListEl = document.getElementById('memoList');
    new Sortable(memoListEl, {
        animation: 150,
        delay: 100,
        delayOnTouchOnly: true,
        onEnd: function() { saveMemoOrder(); }
    });
    
    document.getElementById('startTime').addEventListener('input', calculateDuration);
    document.getElementById('endTime').addEventListener('input', calculateDuration);
    calculateDuration();
};

// ==========================================
// データ保存・読み込み
// ==========================================

function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function saveAllSchedules() {
    if (currentScheduleName) {
        const memoVal = document.getElementById('scheduleMemo').value;
        allSchedules[currentScheduleName] = {
            tasks: deepCopy(tasks),
            memo: memoVal
        };
    }
    
    localStorage.setItem('myScheduleApp_All', JSON.stringify(allSchedules));
    localStorage.setItem('myScheduleApp_CurrentName', currentScheduleName);
    localStorage.setItem('myScheduleApp_Trash', JSON.stringify(trashSchedules));
}

function loadAllData() {
    const savedAll = localStorage.getItem('myScheduleApp_All');
    const savedName = localStorage.getItem('myScheduleApp_CurrentName');
    const savedTrash = localStorage.getItem('myScheduleApp_Trash');

    if (savedTrash) trashSchedules = JSON.parse(savedTrash);

    if (savedAll) {
        allSchedules = JSON.parse(savedAll);
        Object.keys(allSchedules).forEach(key => {
            if (Array.isArray(allSchedules[key])) {
                allSchedules[key] = { tasks: allSchedules[key], memo: "" };
            }
        });

        if (savedName && allSchedules[savedName]) {
            currentScheduleName = savedName;
        } else {
            const keys = Object.keys(allSchedules);
            currentScheduleName = keys.length > 0 ? keys[0] : "デフォルト";
            if (!allSchedules[currentScheduleName]) allSchedules[currentScheduleName] = { tasks: [], memo: "" };
        }
    } else {
        const oldData = localStorage.getItem('myScheduleData');
        const initialTasks = oldData ? JSON.parse(oldData) : [];
        allSchedules = { "デフォルト": { tasks: initialTasks, memo: "" } };
        currentScheduleName = "デフォルト";
    }

    const currentData = allSchedules[currentScheduleName];
    tasks = deepCopy(currentData.tasks);
    const memoEl = document.getElementById('scheduleMemo');
    if (memoEl) memoEl.value = currentData.memo || "";
}

function cleanupTrash() {
    const NOW = Date.now();
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    const initialCount = trashSchedules.length;
    trashSchedules = trashSchedules.filter(item => (NOW - item.deletedAt) < THREE_DAYS_MS);
    if (trashSchedules.length < initialCount) saveAllSchedules();
}

// バージョン情報の読み書き
function loadVersion() {
    const v = localStorage.getItem('myScheduleApp_Version');
    if (v) appVersion = v;
    document.getElementById('versionDisplay').textContent = `(${appVersion})`;
}

function editVersion() {
    const newV = prompt("アプリのバージョンを入力してください:", appVersion);
    if (newV) {
        appVersion = newV;
        localStorage.setItem('myScheduleApp_Version', appVersion);
        document.getElementById('versionDisplay').textContent = `(${appVersion})`;
    }
}

// ==========================================
// スケジュール管理機能
// ==========================================

function createNewSchedule() {
    const name = prompt("新しいスケジュールの名前を入力してください:");
    if (!name) return;
    if (allSchedules[name]) {
        alert("その名前のスケジュールは既に存在します");
        return;
    }

    allSchedules[name] = { tasks: [], memo: "" };
    currentScheduleName = name;
    
    saveAllSchedules();
    renderScheduleSelector();
    updateUI(false);
    
    document.getElementById('scheduleMemo').value = "";
}

function copyCurrentSchedule() {
    const baseName = currentScheduleName;
    const newName = prompt(`「${baseName}」を複製します。\n新しい名前を入力してください:`, baseName + "のコピー");
    
    if (!newName) return;
    if (allSchedules[newName]) {
        alert("その名前のスケジュールは既に存在します");
        return;
    }

    const sourceData = allSchedules[baseName];
    allSchedules[newName] = {
        tasks: deepCopy(sourceData.tasks),
        memo: sourceData.memo
    };
    
    currentScheduleName = newName;
    saveAllSchedules();
    renderScheduleSelector();
    switchSchedule();
}

function renameSchedule() {
    const newName = prompt("スケジュールの新しい名前を入力してください:", currentScheduleName);
    if (!newName || newName === currentScheduleName) return;
    if (allSchedules[newName]) {
        alert("その名前のスケジュールは既に存在します");
        return;
    }

    allSchedules[newName] = allSchedules[currentScheduleName];
    delete allSchedules[currentScheduleName];
    
    currentScheduleName = newName;
    saveAllSchedules();
    renderScheduleSelector();
}

function deleteCurrentSchedule() {
    const keys = Object.keys(allSchedules);
    if (keys.length <= 1) {
        alert("スケジュールが1つしかないため削除できません");
        return;
    }

    if (!confirm(`現在のスケジュール「${currentScheduleName}」を削除してゴミ箱に移動しますか？`)) return;

    trashSchedules.push({
        name: currentScheduleName,
        data: deepCopy(allSchedules[currentScheduleName]),
        deletedAt: Date.now()
    });

    delete allSchedules[currentScheduleName];
    
    currentScheduleName = Object.keys(allSchedules)[0];
    
    saveAllSchedules();
    renderScheduleSelector();
    switchSchedule();
    renderTrashList();
}

function saveMemoToSchedule() {
    const val = document.getElementById('scheduleMemo').value;
    if (allSchedules[currentScheduleName]) {
        allSchedules[currentScheduleName].memo = val;
        saveAllSchedules(); 
    }
}

// ==========================================
// UI更新系（リスト内編集機能を含む）
// ==========================================

function renderScheduleSelector() {
    const selector = document.getElementById('scheduleSelector');
    selector.innerHTML = "";
    Object.keys(allSchedules).forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        if (name === currentScheduleName) option.selected = true;
        selector.appendChild(option);
    });
}

function switchSchedule() {
    if (editingIndex !== -1) cancelInlineEdit();
    saveAllSchedules();
    const selector = document.getElementById('scheduleSelector');
    currentScheduleName = selector.value;
    
    const currentData = allSchedules[currentScheduleName];
    tasks = deepCopy(currentData.tasks);
    document.getElementById('scheduleMemo').value = currentData.memo || "";

    updateUI(false);
}

function updateUI(shouldSave = false) {
    if (shouldSave) saveAllSchedules();
    
    const list = document.getElementById('taskList');
    list.innerHTML = "";

    tasks.forEach((task, index) => {
        const li = document.createElement('li');
        
        if (index === editingIndex) {
            li.style.flexDirection = "column"; 
            li.style.alignItems = "stretch";
            li.style.background = "#e3f2fd"; 
            
            li.innerHTML = `
                <div style="display:flex; gap:5px; margin-bottom:5px;">
                    <input type="time" id="edit-start-${index}" value="${task.start}" style="padding:5px;">
                    <span style="align-self:center;">～</span>
                    <input type="time" id="edit-end-${index}" value="${task.end}" style="padding:5px;">
                </div>
                <input type="text" id="edit-name-${index}" value="${task.name}" style="padding:5px; margin-bottom:5px; width:95%;">
                <div style="text-align:right;">
                    <button onclick="saveInlineEdit(${index})" style="background-color: #f39c12; color:white; border:none; padding:5px 15px; border-radius:3px; margin-right:5px; cursor:pointer;">保存</button>
                    <button onclick="cancelInlineEdit()" style="background-color: #95a5a6; color:white; border:none; padding:5px 10px; border-radius:3px; cursor:pointer;">中止</button>
                </div>
            `;
        } else {
            li.innerHTML = `
                <span>${task.start} - ${task.end} : <strong>${task.name}</strong></span>
                <div>
                    <button onclick="enableInlineEdit(${index})" style="background-color: #3498db; color:white; border:none; border-radius:3px; margin-right:5px; padding:5px 10px; font-size:0.8rem; cursor:pointer;">編集</button>
                    <button class="delete-btn" onclick="deleteTask(${index})">削除</button>
                </div>
            `;
        }
        list.appendChild(li);
    });

    renderCharts();
}

function enableInlineEdit(index, scroll = false) {
    editingIndex = index;
    updateUI(false);
    
    if (scroll) {
        const list = document.getElementById('taskList');
        if (list.children[index]) {
            list.children[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

function cancelInlineEdit() {
    editingIndex = -1;
    updateUI(false);
}

function saveInlineEdit(index) {
    const start = document.getElementById(`edit-start-${index}`).value;
    const end = document.getElementById(`edit-end-${index}`).value;
    const name = document.getElementById(`edit-name-${index}`).value;

    if (!start || !end || !name) {
        alert("すべての項目を入力してください");
        return;
    }

    const startMin = timeToMinutes(start);
    const endMin = timeToMinutes(end);

    if (startMin >= endMin) {
        alert("終了時間は開始時間より後に設定してください");
        return;
    }

    const hasOverlap = tasks.some((task, i) => {
        if (i === index) return false;
        const tStart = timeToMinutes(task.start);
        const tEnd = timeToMinutes(task.end);
        return startMin < tEnd && endMin > tStart;
    });

    if (hasOverlap) {
        alert("時間が他のスケジュールと重なっています！");
        return;
    }

    tasks[index] = { start, end, name };
    editingIndex = -1; 
    
    tasks.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
    updateUI(true);
}

// ==========================================
// トップの追加フォーム
// ==========================================

function calculateDuration() {
    const start = document.getElementById('startTime').value;
    const end = document.getElementById('endTime').value;
    const display = document.getElementById('durationDisplay');
    if (!start || !end) { display.textContent = ""; return; }
    const diff = timeToMinutes(end) - timeToMinutes(start);
    if (diff <= 0) { display.textContent = "（時間が正しくありません）"; display.style.color = "red"; } 
    else { display.textContent = " ⏳ " + formatDuration(diff); display.style.color = "#4a90e2"; }
}

function addTask() {
    const start = document.getElementById('startTime').value;
    const end = document.getElementById('endTime').value;
    const name = document.getElementById('taskName').value;

    if (!start || !end || !name) { alert("すべての項目を入力してください"); return; }
    if (timeToMinutes(start) >= timeToMinutes(end)) { alert("終了時間は開始時間より後に設定してください"); return; }

    const hasOverlap = tasks.some(task => {
        const tStart = timeToMinutes(task.start);
        const tEnd = timeToMinutes(task.end);
        return timeToMinutes(start) < tEnd && timeToMinutes(end) > tStart;
    });

    if (hasOverlap) { alert("時間が他のスケジュールと重なっています！"); return; }

    if (editingIndex !== -1) cancelInlineEdit();

    tasks.push({ start, end, name });
    document.getElementById('taskName').value = "";
    
    tasks.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
    updateUI(true);
}
// ==========================================
// タスク削除・空き時間入力支援
// ==========================================

function deleteTask(index) {
    if (editingIndex === index) cancelInlineEdit();
    else if (editingIndex > index) editingIndex--;
    
    tasks.splice(index, 1);
    updateUI(true);
}

function fillFormForNewTask(startStr, endStr) {
    if (editingIndex !== -1) cancelInlineEdit();

    document.getElementById('startTime').value = startStr;
    
    // ■修正: 24:00 (00:00) のエラー対策
    if (endStr === "24:00") {
        document.getElementById('endTime').value = "23:59";
    } else {
        document.getElementById('endTime').value = endStr;
    }

    document.getElementById('taskName').value = ""; 

    calculateDuration();

    window.scrollTo({ top: 0, behavior: 'smooth' });

    setTimeout(() => {
        document.getElementById('taskName').focus();
    }, 500); 
}

// ==========================================
// ヘルパー関数・グラフ描画
// ==========================================

function timeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function minutesToTime(mins) {
    let h = Math.floor(mins / 60);
    let m = mins % 60;
    return ('00' + h).slice(-2) + ':' + ('00' + m).slice(-2);
}

function formatDuration(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    let str = "";
    if (h > 0) str += h + "時間";
    if (m > 0) str += m + "分";
    return str;
}

function renderCharts() {
    drawPieChart('amChart', 0, 720, amChart, (newChart) => amChart = newChart);
    drawPieChart('pmChart', 720, 1440, pmChart, (newChart) => pmChart = newChart);
}

function drawPieChart(canvasId, rangeStart, rangeEnd, currentChartInstance, setChartInstance) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (currentChartInstance) currentChartInstance.destroy();

    let chartData = [];
    let chartLabels = []; 
    let chartColors = [];
    const palette = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];
    let colorIndex = 0;
    
    let currentPos = rangeStart; 

    tasks.forEach((task, index) => {
        const tStart = timeToMinutes(task.start);
        const tEnd = timeToMinutes(task.end);

        if (tEnd > rangeStart && tStart < rangeEnd) {
            
            const drawStart = Math.max(tStart, rangeStart);
            const drawEnd = Math.min(tEnd, rangeEnd);

            if (drawStart > currentPos) {
                const gap = drawStart - currentPos;
                chartData.push(gap);
                chartLabels.push({ 
                    name: "空き時間", 
                    timeStr: minutesToTime(currentPos) + ' - ' + minutesToTime(drawStart),
                    isTask: false,
                    start: minutesToTime(currentPos),
                    end: minutesToTime(drawStart)
                });
                chartColors.push("#e0e0e0");
            }

            const duration = drawEnd - drawStart;
            chartData.push(duration);
            chartLabels.push({ 
                name: task.name, 
                timeStr: task.start + ' - ' + task.end, 
                isTask: true,
                originalIndex: index 
            });
            chartColors.push(palette[colorIndex % palette.length]);
            
            currentPos = drawEnd;
        }
        colorIndex++;
    });

    if (currentPos < rangeEnd) {
        chartData.push(rangeEnd - currentPos);
        chartLabels.push({ 
            name: "空き時間", 
            timeStr: minutesToTime(currentPos) + ' - ' + minutesToTime(rangeEnd),
            isTask: false,
            start: minutesToTime(currentPos),
            end: minutesToTime(rangeEnd)
        });
        chartColors.push("#e0e0e0");
    }

    const newChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: chartLabels.map(l => l.name),
            datasets: [{
                data: chartData,
                backgroundColor: chartColors,
                borderWidth: 1,
                borderColor: "#fff"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            rotation: 0, 
            onClick: (e, elements, chart) => {
                if (elements.length > 0) {
                    const dataIndex = elements[0].index;
                    const labelInfo = chartLabels[dataIndex];
                    
                    if (labelInfo) {
                        if (labelInfo.isTask && typeof labelInfo.originalIndex === 'number') {
                            enableInlineEdit(labelInfo.originalIndex, true);
                        } else if (!labelInfo.isTask) {
                            fillFormForNewTask(labelInfo.start, labelInfo.end);
                        }
                    }
                }
            },
            plugins: {
                legend: { display: false },
                datalabels: {
                    anchor: 'end',
                    align: 'start',
                    offset: 10,
                    color: (context) => context.dataset.backgroundColor[context.dataIndex] === "#e0e0e0" ? "#666" : "#fff",
                    font: { weight: 'bold', size: 12 },
                    formatter: function(value, context) {
                        if (value < 15) return ""; 
                        const info = chartLabels[context.dataIndex];
                        let label = info.name + '\n' + info.timeStr;
                        label += '\n(⏳ ' + formatDuration(value) + ')';
                        return label;
                    },
                    textAlign: 'center'
                }
            }
        }
    });

    setChartInstance(newChart);
}

// ==========================================
// ゴミ箱機能
// ==========================================

function toggleTrash() {
    const area = document.getElementById('trashArea');
    if (area.style.display === "none") {
        area.style.display = "block";
        renderTrashList();
    } else {
        area.style.display = "none";
    }
}

function renderTrashList() {
    const list = document.getElementById('trashList');
    list.innerHTML = "";

    if (trashSchedules.length === 0) {
        list.innerHTML = "<li style='background:none; color:#7f8c8d;'>ゴミ箱は空です</li>";
        return;
    }

    trashSchedules.forEach((item, index) => {
        const li = document.createElement('li');
        const dateStr = new Date(item.deletedAt).toLocaleDateString() + " " + new Date(item.deletedAt).getHours() + "時頃";
        
        li.innerHTML = `
            <span><strong>${item.name}</strong> (${dateStr} 削除)</span>
            <div>
                <button onclick="restoreSchedule(${index})" style="background-color: #2ecc71; color:white; border:none;">復元</button>
                <button onclick="permanentDelete(${index})" style="background-color: #e74c3c; color:white; border:none;">完全削除</button>
            </div>
        `;
        list.appendChild(li);
    });
}

function restoreSchedule(index) {
    const item = trashSchedules[index];
    let restoreName = item.name;

    if (allSchedules[restoreName]) {
        restoreName = restoreName + "(復元)";
        if (allSchedules[restoreName]) {
            restoreName = prompt("同名のスケジュールが存在します。復元後の名前を入力してください:", restoreName);
            if (!restoreName || allSchedules[restoreName]) {
                alert("復元できませんでした");
                return;
            }
        }
    }

    if (Array.isArray(item.data)) {
        allSchedules[restoreName] = { tasks: item.data, memo: "" };
    } else {
        allSchedules[restoreName] = item.data;
    }
    
    trashSchedules.splice(index, 1);
    currentScheduleName = restoreName;
    const restoredData = allSchedules[currentScheduleName];
    tasks = deepCopy(restoredData.tasks);
    document.getElementById('scheduleMemo').value = restoredData.memo || "";

    alert(`「${restoreName}」を復元しました`);
    saveAllSchedules();
    renderScheduleSelector();
    updateUI(false);
    renderTrashList();
}

function permanentDelete(index) {
    if (!confirm("これを削除すると二度と元に戻せません。本当によろしいですか？")) return;
    trashSchedules.splice(index, 1);
    saveAllSchedules();
    renderTrashList();
}

// ==========================================
// 開発メモ機能
// ==========================================

function addMemo() {
    const input = document.getElementById('memoInput');
    const text = input.value;
    if (!text) return;
    memos.push(text);
    input.value = "";
    updateMemoUI();
}

function updateMemoUI() {
    localStorage.setItem('myDevMemos', JSON.stringify(memos));

    const list = document.getElementById('memoList');
    list.innerHTML = "";

    memos.forEach((memo, index) => {
        const li = document.createElement('li');
        li.style.display = "flex";
        li.style.justifyContent = "space-between";
        li.style.alignItems = "center";
        li.style.cursor = "move"; 
        li.style.userSelect = "none";

        li.innerHTML = `
            <span style="flex-grow: 1; word-break: break-all; margin-right: 10px;">${memo}</span>
            <div style="display:flex; align-items:center; flex-shrink: 0;">
                <button onclick="editMemo(${index})" style="background-color: #3498db; color:white; border:none; border-radius:3px; margin-right:5px; padding:5px 10px; font-size:0.8rem; cursor:pointer; white-space: nowrap;">編集</button>
                <button onclick="deleteMemo(${index})" class="delete-btn" style="cursor:pointer; white-space: nowrap;">削除</button>
            </div>
        `;
        list.appendChild(li);
    });
}

function saveMemoOrder() {
    const list = document.getElementById('memoList');
    memos = Array.from(list.children).map(li => 
        li.querySelector('span').textContent
    );
    localStorage.setItem('myDevMemos', JSON.stringify(memos));
}

function deleteMemo(index) {
    const targetText = memos[index];
    if (confirm(`以下のメモを削除しますか？\n\n「${targetText}」`)) {
        memos.splice(index, 1);
        updateMemoUI();
    }
}

function editMemo(index) {
    const currentText = memos[index];
    const newText = prompt("メモを編集:", currentText);
    if (newText !== null && newText !== "") {
        memos[index] = newText;
        updateMemoUI();
    }
}

function loadMemos() {
    const data = localStorage.getItem('myDevMemos');
    if (data) memos = JSON.parse(data);
    updateMemoUI();
}

// ==========================================
// バックアップ・復元機能
// ==========================================

function exportData() {
    // 保存するデータをまとめる
    const dataToSave = {
        version: appVersion,
        allSchedules: allSchedules,
        currentScheduleName: currentScheduleName,
        trashSchedules: trashSchedules,
        memos: memos,
        exportDate: new Date().toISOString() // 保存日時
    };

    // JSON文字列に変換
    const jsonStr = JSON.stringify(dataToSave, null, 2); // 見やすく整形

    // ダウンロードリンクを作成してクリックさせる
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    // ファイル名: schedule_backup_20250101.json のような形式
    const date = new Date();
    const dateStr = date.getFullYear() + 
                    ('0' + (date.getMonth() + 1)).slice(-2) + 
                    ('0' + date.getDate()).slice(-2);
    
    a.href = url;
    a.download = `schedule_backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importData(inputElement) {
    const file = inputElement.files[0];
    if (!file) return;

    if (!confirm("現在のデータを上書きして復元しますか？\n（現在のデータは消えますのでご注意ください）")) {
        inputElement.value = ""; // キャンセル時は入力をリセット
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const loadedData = JSON.parse(e.target.result);

            // データの簡易チェック（必須データがあるか）
            if (!loadedData.allSchedules || !loadedData.currentScheduleName) {
                alert("データの形式が正しくありません。");
                return;
            }

            // データを変数に反映
            allSchedules = loadedData.allSchedules;
            currentScheduleName = loadedData.currentScheduleName;
            trashSchedules = loadedData.trashSchedules || [];
            memos = loadedData.memos || [];
            appVersion = loadedData.version || "v1.0";

            // ローカルストレージに保存
            saveAllSchedules();
            localStorage.setItem('myDevMemos', JSON.stringify(memos));
            localStorage.setItem('myScheduleApp_Version', appVersion);

            alert("復元が完了しました！");
            
            // 画面をリロードして反映
            window.location.reload();

        } catch (err) {
            console.error(err);
            alert("ファイルの読み込みに失敗しました。\n正しいJSONファイルか確認してください。");
        }
    };
    reader.readAsText(file);
}

// ==========================================
// ■追加：簡易パスワード機能
// ==========================================
function checkPassword() {
    const input = document.getElementById('appPassword').value;
    const errorMsg = document.getElementById('loginError');
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');

    // ★ここでパスワードを設定（好きな文字に変えてください）
    const MY_PASSWORD = "1234"; 

    if (input === MY_PASSWORD) {
        // 正解ならログイン画面を消してアプリを表示
        loginScreen.style.display = "none";
        mainApp.style.display = "block";
        
        // 念のためパスワード欄をクリア
        document.getElementById('appPassword').value = "";
    } else {
        // 間違い
        errorMsg.style.display = "block";
    }
}