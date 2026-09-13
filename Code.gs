/**
 * Backend CBT MAN 1 Malang
 * Terhubung ke Google Spreadsheet yang diberikan pengguna.
 */
const CONFIG = Object.freeze({
  SPREADSHEET_ID: '1YDnr6yHS5xHLKeEHyeCCLVnQB4CK9H1EQjifxhq8HFA/edit?gid=0#gid=0',
  SCHOOL_CODE: 'MAN1MALANG',
  SCHOOL_NAME: 'MAN 1 MALANG',
  SCHOOL_LOGO: 'https://lh3.googleusercontent.com/d/1Uw3VpAtFNUC_lKSrN4H8GcYWKjyg_9xJ',
  SHEETS: Object.freeze({
    STUDENTS: 'Siswa',
    EXAMS: 'Ujian',
    ANSWERS: 'Jawaban'
  })
});

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || '').trim();

  try {
    if (!action) {
      const template = HtmlService.createTemplateFromFile('index');
      template.apiUrl = ScriptApp.getService().getUrl();
      return template.evaluate()
        .setTitle('CBT SIM Sekolah | Portal Ujian')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    switch (action) {
      case 'getSchool':
        return getSchool_(e.parameter.code);
      case 'getSchoolInfo':
        return json_({
          status: 'success',
          data: {
            nama_sekolah: CONFIG.SCHOOL_NAME,
            code: CONFIG.SCHOOL_CODE,
            logo: CONFIG.SCHOOL_LOGO
          }
        });
      case 'login':
        return login_(e.parameter.nisn, e.parameter.password);
      case 'getExams':
        return getExams_(e.parameter.nisn, e.parameter.kelas);
      case 'getExam':
        return getExam_(e.parameter.examId, e.parameter.nisn);
      default:
        return json_({ status: 'error', message: 'Aksi tidak dikenal.' });
    }
  } catch (error) {
    console.error(error);
    return json_({ status: 'error', message: safeError_(error) });
  }
}

function doPost(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || '').trim();
    if (action !== 'submitExam') {
      return json_({ status: 'error', message: 'Aksi POST tidak dikenal.' });
    }
    return submitExam_(e.parameter);
  } catch (error) {
    console.error(error);
    return json_({ status: 'error', message: safeError_(error) });
  }
}

function getSchool_(code) {
  if (normalize_(code) !== normalize_(CONFIG.SCHOOL_CODE)) {
    return json_({
      status: 'error',
      message: 'Kode sekolah tidak ditemukan. Gunakan kode MAN1MALANG.'
    });
  }

  return json_({
    status: 'success',
    data: {
      code: CONFIG.SCHOOL_CODE,
      nama_sekolah: CONFIG.SCHOOL_NAME,
      url_gas: ScriptApp.getService().getUrl(),
      logo: CONFIG.SCHOOL_LOGO
    }
  });
}

function login_(nisn, password) {
  const wantedNisn = normalize_(nisn);
  const wantedPassword = String(password == null ? '' : password).trim();
  if (!wantedNisn || !wantedPassword) {
    return json_({ status: 'error', message: 'NISN dan password wajib diisi.' });
  }

  const rows = getDisplayRows_(CONFIG.SHEETS.STUDENTS);
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (normalize_(row[0]) === wantedNisn && String(row[3] || '').trim() === wantedPassword) {
      return json_({
        status: 'success',
        data: {
          nisn: String(row[0] || '').trim(),
          nama: String(row[1] || '').trim(),
          kelas: String(row[2] || '').trim(),
          foto: String(row[4] || '').trim()
        }
      });
    }
  }

  return json_({ status: 'error', message: 'NISN atau password salah.' });
}

function getExams_(nisn, kelas) {
  const student = findStudent_(nisn);
  if (!student) {
    return json_({ status: 'error', message: 'Data siswa tidak ditemukan.' });
  }

  const studentClass = String(student.kelas || kelas || '').trim();
  const scoreMap = getSubmittedScores_(student.nisn);
  const rows = getDisplayRows_(CONFIG.SHEETS.EXAMS);
  const exams = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const examId = String(row[0] || '').trim();
    const examClass = String(row[3] || '').trim();
    const status = normalize_(row[6]);
    if (!examId || status !== 'ACTIVE' || !classMatches_(studentClass, examClass)) continue;

    const item = {
      exam_id: examId,
      title: String(row[1] || '').trim(),
      subject: String(row[2] || '').trim(),
      kelas: examClass,
      tanggal: String(row[4] || '').trim(),
      duration_minutes: number_(row[5], 60),
      jml_soal: number_(row[7], 0),
      token: String(row[8] || '').trim()
    };

    if (Object.prototype.hasOwnProperty.call(scoreMap, examId)) {
      item.score = scoreMap[examId];
    }
    exams.push(item);
  }

  return json_({ status: 'success', exams: exams });
}

function getExam_(examId, nisn) {
  const cleanExamId = String(examId || '').trim();
  const student = findStudent_(nisn);
  if (!student) {
    return json_({ status: 'error', message: 'Data siswa tidak ditemukan.' });
  }
  if (!cleanExamId || !isAllowedExam_(cleanExamId, student.kelas)) {
    return json_({ status: 'error', message: 'Ujian tidak tersedia untuk kelas siswa.' });
  }

  const sheet = spreadsheet_().getSheetByName(cleanExamId);
  if (!sheet) {
    return json_({ status: 'error', message: 'Tab bank soal "' + cleanExamId + '" tidak ditemukan.' });
  }

  const rows = sheet.getDataRange().getDisplayValues();
  const questions = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const id = String(row[0] || '').trim();
    if (!id) continue;
    questions.push({
      id: id,
      no: number_(row[1], questions.length + 1),
      tipe: String(row[2] || 'pg').trim().toLowerCase(),
      pertanyaan: String(row[3] || ''),
      a: String(row[4] || ''),
      b: String(row[5] || ''),
      c: String(row[6] || ''),
      d: String(row[7] || ''),
      e: String(row[8] || ''),
      kunci: String(row[9] || '').trim(),
      kesulitan: String(row[10] || '').trim()
    });
  }

  return json_({ status: 'success', questions: questions });
}

function submitExam_(params) {
  const nisn = String(params.nisn || '').trim();
  const examId = String(params.examId || '').trim();
  const student = findStudent_(nisn);
  if (!student) {
    return json_({ status: 'error', message: 'Data siswa tidak ditemukan.' });
  }
  if (!isAllowedExam_(examId, student.kelas)) {
    return json_({ status: 'error', message: 'Ujian tidak valid untuk siswa ini.' });
  }

  let answers;
  try {
    answers = JSON.parse(String(params.jawaban || '{}'));
  } catch (error) {
    return json_({ status: 'error', message: 'Format jawaban tidak valid.' });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const prior = findSubmission_(nisn, examId);
    if (prior) {
      return json_({
        status: 'success',
        message: 'Jawaban sebelumnya sudah tersimpan.',
        nilai: prior.score
      });
    }

    const score = calculateScore_(examId, answers);
    const now = new Date();
    answersSheet_().appendRow([
      now,
      nisn,
      examId,
      JSON.stringify(answers),
      String(params.durasi || ''),
      String(params.device_id || ''),
      Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      score,
      student.nama,
      student.kelas
    ]);

    return json_({ status: 'success', message: 'Jawaban berhasil disimpan.', nilai: score });
  } finally {
    lock.releaseLock();
  }
}

function calculateScore_(examId, answers) {
  const sheet = spreadsheet_().getSheetByName(examId);
  if (!sheet) throw new Error('Tab bank soal tidak ditemukan.');
  const rows = sheet.getDataRange().getDisplayValues();
  let correct = 0;
  let total = 0;

  for (let i = 1; i < rows.length; i++) {
    const id = String(rows[i][0] || '').trim();
    const answerKey = String(rows[i][9] || '').trim();
    if (!id) continue;
    total++;
    if (normalizeAnswer_(answers[id]) === normalizeAnswer_(answerKey) && answerKey !== '') {
      correct++;
    }
  }
  return total ? Math.round((correct / total) * 100) : 0;
}

function getSubmittedScores_(nisn) {
  const rows = getDisplayRows_(CONFIG.SHEETS.ANSWERS);
  const scores = {};
  for (let i = 1; i < rows.length; i++) {
    if (normalize_(rows[i][1]) === normalize_(nisn)) {
      const examId = String(rows[i][2] || '').trim();
      if (examId) scores[examId] = number_(rows[i][7], 0);
    }
  }
  return scores;
}

function findSubmission_(nisn, examId) {
  const rows = getDisplayRows_(CONFIG.SHEETS.ANSWERS);
  for (let i = 1; i < rows.length; i++) {
    if (normalize_(rows[i][1]) === normalize_(nisn) && String(rows[i][2] || '').trim() === examId) {
      return { score: number_(rows[i][7], 0) };
    }
  }
  return null;
}

function findStudent_(nisn) {
  const wanted = normalize_(nisn);
  const rows = getDisplayRows_(CONFIG.SHEETS.STUDENTS);
  for (let i = 1; i < rows.length; i++) {
    if (normalize_(rows[i][0]) === wanted) {
      return {
        nisn: String(rows[i][0] || '').trim(),
        nama: String(rows[i][1] || '').trim(),
        kelas: String(rows[i][2] || '').trim(),
        foto: String(rows[i][4] || '').trim()
      };
    }
  }
  return null;
}

function isAllowedExam_(examId, studentClass) {
  const rows = getDisplayRows_(CONFIG.SHEETS.EXAMS);
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0] || '').trim() === examId &&
        normalize_(rows[i][6]) === 'ACTIVE' &&
        classMatches_(studentClass, rows[i][3])) {
      return true;
    }
  }
  return false;
}

function classMatches_(studentClass, examClass) {
  const student = normalize_(studentClass).replace(/\s+/g, ' ');
  const exam = normalize_(examClass).replace(/\s+/g, ' ');
  return student === exam || student.indexOf(exam + ' ') === 0;
}

function normalizeAnswer_(value) {
  const text = String(value == null ? '' : value).trim().toUpperCase().replace(/\s+/g, '');
  if (text.indexOf(',') === -1) return text;
  return text.split(',').filter(Boolean).sort().join(',');
}

function spreadsheet_() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function answersSheet_() {
  const sheet = spreadsheet_().getSheetByName(CONFIG.SHEETS.ANSWERS);
  if (!sheet) throw new Error('Tab Jawaban tidak ditemukan.');
  return sheet;
}

function getDisplayRows_(sheetName) {
  const sheet = spreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Tab "' + sheetName + '" tidak ditemukan.');
  return sheet.getDataRange().getDisplayValues();
}

function normalize_(value) {
  return String(value == null ? '' : value).trim().toUpperCase();
}

function number_(value, fallback) {
  const parsed = Number(String(value == null ? '' : value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeError_(error) {
  return error && error.message ? error.message : 'Terjadi kesalahan pada server.';
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
