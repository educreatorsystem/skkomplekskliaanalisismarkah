const SPREADSHEET_ID = '18h0tLT4fYbLZs9tkiImTTnngFyl9mqW6TSyXvMm95SE';
const PROPERTY_SPREADSHEET_ID = 'KAFA_EXAM_SPREADSHEET_ID';
const TEACHER_PASSWORD = 'guruskkompleksklia';
const STUDENT_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRnGcJTGbhG1MX4J7CMfqcVGm2vwWE7AHi3fq0uYzg6fz9ed41V1Bjefr-AyveBn3x5yUfaxazRKd-7/pub?gid=0&single=true&output=csv';
const OPTION_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRnGcJTGbhG1MX4J7CMfqcVGm2vwWE7AHi3fq0uYzg6fz9ed41V1Bjefr-AyveBn3x5yUfaxazRKd-7/pub?gid=1612819479&single=true&output=csv';

const STUDENT_SHEET = 'Murid';
const MARK_SHEET = 'Markah';

const STUDENT_HEADERS = ['id', 'ic', 'nama_murid', 'kelas'];
const MARK_HEADERS = [
  'id',
  'student_id',
  'ic',
  'nama_murid',
  'kelas',
  'pentaksiran',
  'subjek',
  'markah',
  'status',
  'gred',
  'tafsiran',
  'created_at',
  'updated_at'
];

const DEFAULT_ASSESSMENTS = [
  'PERTENGAHAN AKADEMIK',
  'AKHIR AKADEMIK'
];

const DEFAULT_SUBJECTS = [
  'B. MELAYU',
  'B. INGGERIS',
  'MATEMATIK',
  'SAINS',
  'SEJARAH',
  'PEN ISLAM',
  'PEN MORAL',
  'B. ARAB',
  'B TAMIL',
  'RBT',
  'PJPK',
  'PSV',
  'MUZIK'
];

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Sistem Analisis Peperiksaan KAFA')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function setupKafaSpreadsheet() {
  const ss = getSpreadsheet_();
  ensureSheets_(ss);
  Logger.log('KAFA spreadsheet: ' + ss.getUrl());
  return ss.getUrl();
}

function getPublicOptions() {
  const ss = getSpreadsheet_();
  ensureSheets_(ss);
  const students = getStudents_();
  const options = getAcademicOptions_();
  return {
    classes: unique_(students.map(student => student.kelas)).sort(localeSort_),
    assessments: options.assessments,
    subjects: options.subjects
  };
}

function loginTeacher(password) {
  if (String(password || '') !== TEACHER_PASSWORD) {
    throw new Error('Password guru tidak tepat.');
  }

  const ss = getSpreadsheet_();
  ensureSheets_(ss);
  const students = getStudents_();
  const marks = getMarks_();
  const options = getAcademicOptions_();

  return {
    students,
    marks,
    options: {
      classes: unique_(students.map(student => student.kelas)).sort(localeSort_),
      assessments: options.assessments,
      subjects: options.subjects
    },
    spreadsheetUrl: ss.getUrl()
  };
}

function lookupStudentByIc(ic) {
  const cleanIc = cleanIc_(ic);
  if (!cleanIc) throw new Error('Sila masukkan nombor IC anak.');

  const ss = getSpreadsheet_();
  ensureSheets_(ss);
  const students = getStudents_();
  const marks = getMarks_();
  const options = getAcademicOptions_();
  const student = students.find(item => cleanIc_(item.ic) === cleanIc);
  if (!student) throw new Error('Nombor IC tidak dijumpai.');

  return {
    student,
    marks: marks.filter(mark => mark.student_id === student.id || cleanIc_(mark.ic) === cleanIc),
    ranks: getParentRanks_(student, students, marks, options.assessments),
    options: {
      assessments: options.assessments,
      subjects: options.subjects
    }
  };
}

function saveMarks(password, payload) {
  if (String(password || '') !== TEACHER_PASSWORD) {
    return { isOk: false, error: 'Password guru tidak tepat.' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const cleanPayload = normalizePayload_(payload);
    const sheet = getSheet_(MARK_SHEET, MARK_HEADERS);
    const values = sheet.getDataRange().getValues();
    const rowsByKey = {};

    values.slice(1).forEach((row, index) => {
      const item = rowToObject_(MARK_HEADERS, row);
      const key = markKey_(item.student_id, item.pentaksiran, item.subjek);
      rowsByKey[key] = index + 2;
    });

    cleanPayload.rows.forEach(row => {
      const key = markKey_(row.student_id, cleanPayload.pentaksiran, cleanPayload.subjek);
      const rowNumber = rowsByKey[key];
      const hasValue = row.status || row.markah !== '';

      if (!hasValue && rowNumber) {
        sheet.deleteRow(rowNumber);
        Object.keys(rowsByKey).forEach(existingKey => {
          if (rowsByKey[existingKey] > rowNumber) rowsByKey[existingKey] -= 1;
        });
        delete rowsByKey[key];
        return;
      }

      if (!hasValue) return;

      const now = new Date().toISOString();
      const record = {
        id: row.id || Utilities.getUuid(),
        student_id: row.student_id,
        ic: row.ic,
        nama_murid: row.nama_murid,
        kelas: row.kelas,
        pentaksiran: cleanPayload.pentaksiran,
        subjek: cleanPayload.subjek,
        markah: row.markah,
        status: row.status,
        gred: row.gred,
        tafsiran: row.tafsiran,
        created_at: row.created_at || now,
        updated_at: now
      };

      if (rowNumber) {
        sheet.getRange(rowNumber, 1, 1, MARK_HEADERS.length)
          .setValues([MARK_HEADERS.map(header => record[header] || '')]);
      } else {
        sheet.appendRow(MARK_HEADERS.map(header => record[header] || ''));
      }
    });

    return { isOk: true, marks: getMarks_() };
  } catch (err) {
    return { isOk: false, error: err.message };
  } finally {
    lock.releaseLock();
  }
}

function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const savedId = props.getProperty(PROPERTY_SPREADSHEET_ID);
  const configuredId = SPREADSHEET_ID.trim();

  if (configuredId) {
    props.setProperty(PROPERTY_SPREADSHEET_ID, configuredId);
    return SpreadsheetApp.openById(configuredId);
  }

  if (savedId) return SpreadsheetApp.openById(savedId);

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    props.setProperty(PROPERTY_SPREADSHEET_ID, active.getId());
    return active;
  }

  const created = SpreadsheetApp.create('Data Sistem Analisis Peperiksaan KAFA');
  props.setProperty(PROPERTY_SPREADSHEET_ID, created.getId());
  return created;
}

function ensureSheets_(ss) {
  const markSheet = ss.getSheetByName(MARK_SHEET) || ss.insertSheet(MARK_SHEET);
  ensureHeader_(markSheet, MARK_HEADERS);
}

function getSheet_(name, headers) {
  const ss = getSpreadsheet_();
  ensureSheets_(ss);
  const sheet = ss.getSheetByName(name);
  ensureHeader_(sheet, headers);
  return sheet;
}

function ensureHeader_(sheet, headers) {
  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasHeader = headers.every((header, index) => firstRow[index] === header);
  if (!hasHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function getStudents_() {
  const rows = fetchCsvRows_(STUDENT_CSV_URL);
  if (rows.length <= 1) return [];

  const headers = rows[0].map(String);
  const classIndex = headerIndex_(headers, ['KELAS', 'CLASS']);
  const nameIndex = headerIndex_(headers, ['NAMA MURID', 'NAMA', 'NAME']);
  const icIndex = headerIndex_(headers, ['NO IC', 'NO. IC', 'IC', 'NO KAD PENGENALAN', 'NOMBOR IC']);

  if (classIndex < 0 || nameIndex < 0) {
    throw new Error('CSV murid mesti mempunyai kolum KELAS dan NAMA MURID.');
  }

  return rows.slice(1)
    .map((row, index) => {
      const kelas = String(row[classIndex] || '').trim();
      const nama = String(row[nameIndex] || '').trim();
      const ic = icIndex >= 0 ? String(row[icIndex] || '').trim() : '';
      return {
        id: makeStudentId_(ic, kelas, nama, index),
        ic,
        nama_murid: nama,
        kelas
      };
    })
    .filter(student => student.nama_murid && student.kelas)
    .sort((a, b) => a.kelas.localeCompare(b.kelas, 'ms', { numeric: true, sensitivity: 'base' }) || a.nama_murid.localeCompare(b.nama_murid, 'ms'));
}

function getMarks_() {
  const sheet = getSheet_(MARK_SHEET, MARK_HEADERS);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  return values.slice(1)
    .filter(row => row.some(cell => cell !== ''))
    .map(row => rowToObject_(MARK_HEADERS, row));
}

function getAcademicOptions_() {
  const rows = fetchCsvRows_(OPTION_CSV_URL);
  if (rows.length <= 1) {
    return { assessments: DEFAULT_ASSESSMENTS, subjects: DEFAULT_SUBJECTS };
  }

  const headers = rows[0].map(String);
  const assessmentIndex = headerIndex_(headers, ['PENTAKSIRAN', 'ASSESSMENT']);
  const subjectIndex = headerIndex_(headers, ['SUBJEK', 'MATA PELAJARAN', 'SUBJECT']);

  const assessments = assessmentIndex >= 0
    ? unique_(rows.slice(1).map(row => row[assessmentIndex]))
    : DEFAULT_ASSESSMENTS;
  const subjects = subjectIndex >= 0
    ? unique_(rows.slice(1).map(row => row[subjectIndex]))
    : DEFAULT_SUBJECTS;

  return {
    assessments: assessments.length ? assessments : DEFAULT_ASSESSMENTS,
    subjects: subjects.length ? subjects : DEFAULT_SUBJECTS
  };
}

function fetchCsvRows_(url) {
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Gagal membaca CSV sumber. Kod respons: ' + code);
  }
  return Utilities.parseCsv(response.getContentText());
}

function headerIndex_(headers, candidates) {
  const normalizedHeaders = headers.map(normalizeHeader_);
  const normalizedCandidates = candidates.map(normalizeHeader_);
  return normalizedHeaders.findIndex(header => normalizedCandidates.includes(header));
}

function normalizeHeader_(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function makeStudentId_(ic, kelas, nama, index) {
  const cleanIc = cleanIc_(ic);
  if (cleanIc) return 'IC_' + cleanIc;
  const source = [kelas, nama, index + 2].join('|').toUpperCase();
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, source);
  return 'NM_' + Utilities.base64EncodeWebSafe(digest).replace(/=+$/g, '').slice(0, 18);
}

function getParentRanks_(student, students, marks, assessments) {
  const ranks = {};
  assessments.forEach(assessment => {
    const ranked = students
      .filter(item => item.kelas === student.kelas)
      .map(item => {
        const validMarks = marks.filter(mark => mark.student_id === item.id && mark.pentaksiran === assessment && isValidMark_(mark));
        const total = validMarks.reduce((sum, mark) => sum + Number(mark.markah), 0);
        return {
          id: item.id,
          name: item.nama_murid,
          total,
          average: validMarks.length ? total / validMarks.length : 0,
          count: validMarks.length
        };
      })
      .filter(item => item.count)
      .sort((a, b) => b.average - a.average || b.total - a.total || a.name.localeCompare(b.name, 'ms'));

    const index = ranked.findIndex(item => item.id === student.id);
    ranks[assessment] = index >= 0 ? index + 1 : '';
  });
  return ranks;
}

function isValidMark_(mark) {
  return !mark.status && mark.markah !== '' && Number.isFinite(Number(mark.markah));
}

function rowToObject_(headers, row) {
  const item = {};
  headers.forEach((header, index) => {
    item[header] = row[index] === null || row[index] === undefined ? '' : String(row[index]);
  });
  return item;
}

function normalizePayload_(payload) {
  const pentaksiran = String(payload && payload.pentaksiran || '').trim();
  const subjek = String(payload && payload.subjek || '').trim();
  const rows = Array.isArray(payload && payload.rows) ? payload.rows : [];
  const options = getAcademicOptions_();

  if (!options.assessments.includes(pentaksiran)) throw new Error('Pentaksiran tidak sah.');
  if (!options.subjects.includes(subjek)) throw new Error('Subjek tidak sah.');

  return {
    pentaksiran,
    subjek,
    rows: rows.map(normalizeMarkRow_)
  };
}

function normalizeMarkRow_(row) {
  const status = String(row.status || '').trim().toUpperCase();
  const rawMark = String(row.markah === null || row.markah === undefined ? '' : row.markah).trim();

  if (status && !['TD', 'TH'].includes(status)) throw new Error('Status markah tidak sah.');

  let markah = '';
  if (!status && rawMark !== '') {
    const mark = Number(rawMark);
    if (!Number.isFinite(mark) || mark < 0 || mark > 100) {
      throw new Error('Markah mesti antara 0 hingga 100.');
    }
    markah = String(Math.round(mark));
  }

  const grade = status ? status : gradeForMark_(Number(markah));
  return {
    id: String(row.id || '').trim(),
    student_id: String(row.student_id || '').trim(),
    ic: String(row.ic || '').trim(),
    nama_murid: String(row.nama_murid || '').trim(),
    kelas: String(row.kelas || '').trim(),
    markah,
    status,
    gred: markah === '' && !status ? '' : grade,
    tafsiran: markah === '' && !status ? '' : tafsiranForGrade_(grade),
    created_at: String(row.created_at || '').trim()
  };
}

function gradeForMark_(mark) {
  if (!Number.isFinite(mark)) return '';
  if (mark >= 80) return 'A';
  if (mark >= 60) return 'B';
  if (mark >= 50) return 'C';
  return 'D';
}

function tafsiranForGrade_(grade) {
  return {
    A: 'Cemerlang',
    B: 'Baik',
    C: 'Memuaskan',
    D: 'Gagal',
    TD: 'Tidak Ditaksir / Tidak Daftar',
    TH: 'Tidak Hadir'
  }[grade] || '';
}

function markKey_(studentId, assessment, subject) {
  return [studentId, assessment, subject].map(value => String(value || '').trim().toUpperCase()).join('|');
}

function cleanIc_(ic) {
  return String(ic || '').replace(/\D/g, '');
}

function unique_(values) {
  return Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean)));
}

function localeSort_(a, b) {
  return a.localeCompare(b, 'ms', { numeric: true, sensitivity: 'base' });
}
