/**
 * RadicalMediaPh - website form receiver
 * ---------------------------------------------------------------------------
 * Receives submissions from the website's contact / lead-gen / ebook forms
 * and appends one row per message to the Google Sheet, then emails an alert.
 *
 * It matches your EXISTING header row (Name / Mobile / Email / Concerns ...)
 * and only adds a new column when there is nowhere to put a value, so your
 * current layout is never rearranged.
 *
 * SETUP - see SETUP.md in this folder.
 * ---------------------------------------------------------------------------
 */

var SHEET_ID   = '1OviCHauAha6LI62U3LDcrs6Oj8WPeEKchpxtzKVyyUY';
var SHEET_NAME = '';  // leave empty to use the first tab

// Must match SITE.sheetToken in assets/js/main.js. Keeps casual bots out.
var TOKEN = 'rmph-2026-web';

// Email address alerted on every new message. Leave empty for no alerts.
var NOTIFY_EMAIL = 'radicalmediaph@gmail.com';

// The fields a submission can carry, in the order new columns get added.
// Each one lists the header names it will happily sit under.
var FIELDS = [
  { key: 'timestamp', title: 'Timestamp', match: ['timestamp', 'date', 'datesent', 'time', 'dateandtime'] },
  { key: 'name',      title: 'Name',      match: ['name', 'fullname', 'clientname', 'contactname'] },
  { key: 'phone',     title: 'Mobile',    match: ['mobile', 'phone', 'mobilenumber', 'phonenumber', 'contact', 'contactnumber', 'whatsapp'] },
  { key: 'email',     title: 'Email',     match: ['email', 'emailaddress', 'mail'] },
  { key: 'message',   title: 'Concerns',  match: ['concerns', 'concern', 'message', 'details', 'inquiry', 'enquiry', 'notes', 'goal'] },
  { key: 'company',   title: 'Company',   match: ['company', 'business', 'organisation', 'organization'] },
  { key: 'subject',   title: 'Subject',   match: ['subject', 'topic', 'regarding'] },
  { key: 'form',      title: 'Form',      match: ['form', 'formname', 'source', 'type'] },
  { key: 'extra',     title: 'Extra',     match: ['extra', 'other', 'additional', 'otherdetails'] },
  { key: 'page',      title: 'Page',      match: ['page', 'sourcepage', 'frompage'] }
];

// Header names that hold a phone number (kept as text, never a number).
var PHONE_HEADERS = ['mobile', 'phone', 'mobilenumber', 'phonenumber', 'contact', 'contactnumber', 'whatsapp'];

/* ----------------------------------------------------------- web endpoints */

function doPost(e) {
  try {
    var data = {};
    if (e && e.postData && e.postData.contents) {
      try { data = JSON.parse(e.postData.contents); }
      catch (err) { data = e.parameter || {}; }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    if (TOKEN && String(data.token || '') !== TOKEN) {
      return reply({ ok: false, error: 'bad token' });
    }

    var result = writeRow(data);
    notify(data);
    return reply({ ok: true, row: result });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

// Opening the /exec URL in a browser should show this.
function doGet() {
  return reply({ ok: true, service: 'RadicalMediaPh form receiver' });
}

/* ------------------------------------------------------------------- core */

function writeRow(data) {
  var sheet  = getSheet();
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getLastRow() > 0
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    : [];

  // Brand new sheet? Lay down a sensible header row.
  if (!headers.join('')) {
    headers = FIELDS.map(function (f) { return f.title; });
    sheet.getRange(1, 1, 1, headers.length)
         .setValues([headers])
         .setFontWeight('bold')
         .setBackground('#241a33')
         .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }

  var slim = headers.map(normalise);
  var row  = new Array(headers.length).fill('');

  FIELDS.forEach(function (field) {
    var value = valueFor(field.key, data);
    if (value === '') return;

    var at = -1;
    for (var i = 0; i < slim.length; i++) {
      if (slim[i] && field.match.indexOf(slim[i]) !== -1) { at = i; break; }
    }

    if (at === -1) {                       // no column for it yet - add one
      headers.push(field.title);
      slim.push(normalise(field.title));
      row.push('');
      at = headers.length - 1;
      sheet.getRange(1, at + 1)
           .setValue(field.title)
           .setFontWeight('bold')
           .setBackground('#241a33')
           .setFontColor('#ffffff');
    }
    row[at] = value;
  });

  sheet.appendRow(row);
  var r = sheet.getLastRow();

  // Phone numbers must stay exactly as typed - Sheets would otherwise read
  // 09171234567 as a number and eat the leading zero.
  var phoneAt = -1;
  for (var j = 0; j < slim.length; j++) {
    if (slim[j] && PHONE_HEADERS.indexOf(slim[j]) !== -1) { phoneAt = j; break; }
  }
  if (phoneAt !== -1 && row[phoneAt]) {
    sheet.getRange(r, phoneAt + 1).setNumberFormat('@').setValue(row[phoneAt]);
  }

  return r;
}

function valueFor(key, data) {
  if (key === 'timestamp') return new Date();
  return String(data[key] === undefined || data[key] === null ? '' : data[key]).trim();
}

function normalise(h) {
  return String(h || '').toLowerCase().replace(/[^a-z]/g, '');
}

function getSheet() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  if (SHEET_NAME) return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  return ss.getSheets()[0];
}

function notify(data) {
  if (!NOTIFY_EMAIL) return;
  try {
    var lines = [];
    FIELDS.forEach(function (f) {
      if (f.key === 'timestamp') { lines.push('Received: ' + new Date()); return; }
      var v = valueFor(f.key, data);
      if (v) lines.push(f.title + ': ' + v);
    });
    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      subject: 'New website message: ' + (data.subject || data.form || 'enquiry'),
      body: lines.join('\n') + '\n\n- sent automatically from your website'
    });
  } catch (err) {
    // a failed email must never cost you the row
  }
}

function reply(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------------- test */

/**
 * Run this once from the editor (select testWrite > Run) to grant permissions
 * and prove it works. It adds one sample row and emails you.
 */
function testWrite() {
  writeRow({
    name: 'Sample Visitor',
    email: 'sample@example.com',
    phone: '09171234567',
    company: 'Sample Co',
    subject: 'Test from Apps Script',
    message: 'If you can see this row, the connection works.',
    form: 'manual test',
    extra: '',
    page: 'test'
  });
  notify({
    name: 'Sample Visitor',
    email: 'sample@example.com',
    subject: 'Test from Apps Script',
    message: 'If you can see this row, the connection works.',
    form: 'manual test'
  });
}
