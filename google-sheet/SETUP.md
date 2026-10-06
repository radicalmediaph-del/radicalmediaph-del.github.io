# Saving website messages to your Google Sheet

> **Already done - this is live.** The Apps Script is deployed and the website
> is wired to it. Every form submission now lands as a row in your "Clients"
> sheet and emails radicalmediaph@gmail.com.
>
> - Script project: **RadicalMediaPh Website Forms** (in your Apps Script)
> - Web app URL is already in `assets/js/main.js` as `sheetEndpoint`
> - Columns map onto your existing header row: Name / Mobile / Email / Concerns,
>   plus Timestamp, Company, Subject, Form and Page added to the right
>
> The steps below are kept for reference - if you ever need to redo it, move
> to a different sheet, or set it up again on another site.

---

Every message someone sends through any form on the site gets added as a new
row in your spreadsheet:

<https://docs.google.com/spreadsheets/d/1OviCHauAha6LI62U3LDcrs6Oj8WPeEKchpxtzKVyyUY/edit>

The site is a static website, so it can't write to Google on its own. A small
Google Apps Script sits in the middle. It's free, it lives inside your own
Google account, and it takes about five minutes to set up — once.

---

## Step 1 — Open the script editor

1. Open the spreadsheet.
2. Menu: **Extensions → Apps Script**.
3. A new tab opens with a file called `Code.gs` containing `function myFunction() {}`.

## Step 2 — Paste in the code

1. Select everything in that editor and delete it.
2. Open **`Code.gs`** from this folder, copy the whole file, paste it in.
3. Click the **save** icon (or Ctrl+S).

## Step 3 — Give it permission

1. In the toolbar, choose **`testWrite`** from the function dropdown.
2. Click **Run**.
3. Google asks for authorisation: **Review permissions → choose your account →
   Advanced → Go to (project name) → Allow**.
   The "unverified app" warning is normal — it's your own script.
4. Check the spreadsheet: a header row and one test row should now be there.
   Delete the test row.

## Step 4 — Publish it

1. Top right: **Deploy → New deployment**.
2. Click the gear next to "Select type" and pick **Web app**.
3. Set:
   - **Description:** anything, e.g. "Website forms"
   - **Execute as:** **Me**
   - **Who has access:** **Anyone**  ← this matters; without it the website is refused
4. Click **Deploy**, approve if asked.
5. Copy the **Web app URL**. It looks like:
   `https://script.google.com/macros/s/AKfycb..................../exec`

## Step 5 — Tell the website about it

1. Open `assets/js/main.js` in the website folder (Notepad is fine).
2. Near the top, find:

   ```js
   sheetEndpoint: "",
   ```

3. Paste your URL between the quotes:

   ```js
   sheetEndpoint: "https://script.google.com/macros/s/AKfycb..../exec",
   ```

4. Save the file.

## Step 6 — Test it

Open the site, go to **Contact**, fill the form in with your own details and
send it. Within a few seconds a new row appears in the spreadsheet, and you get
an email notification.

---

## What lands in the sheet

| Column | Contains |
| --- | --- |
| Timestamp | When it was sent |
| Form | Which form (contact, ebook order, lead-gen strategy) |
| Name | Their name |
| Email | Their email |
| Phone | Phone / WhatsApp, if the form asked for it |
| Company | Company, if the form asked for it |
| Subject | Subject line or the form's purpose |
| Message | What they actually wrote |
| Extra | Anything form-specific (e.g. number of ebook copies) |
| Page | Which page they submitted from |

## Notes

- **Email alerts.** On by default, sent to radicalmediaph@gmail.com. Change or
  switch off with the `NOTIFY_EMAIL` line at the top of `Code.gs`.
- **If the sheet is unreachable**, nothing is lost — the form falls back to
  offering the visitor email / WhatsApp / copy-to-clipboard, exactly as before.
- **Spam.** A shared token (`rmph-2026-web`) must match between `Code.gs` and
  `main.js`; requests without it are ignored. Change it in both files whenever
  you like.
- **After editing `Code.gs` later**, you must redeploy for changes to take
  effect: **Deploy → Manage deployments → pencil icon → Version: New version →
  Deploy**. The URL stays the same.
- **A different sheet?** Change `SHEET_ID` at the top of `Code.gs` to the long
  code in that sheet's URL.
