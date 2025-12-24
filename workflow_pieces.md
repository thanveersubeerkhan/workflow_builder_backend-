# Workflow Pieces Documentation

This document describes the available pieces, their triggers, actions, and the parameters they accept for configuration.

## 🕒 Schedule

Triggers the workflow at specified time intervals.

### Triggers

#### `schedule`
- **Description:** Standard polling trigger based on intervals.
- **Parameters:**
  - `intervalMinutes` (number): Interval in minutes (e.g., 5).
  - `intervalSeconds` (number): Interval in seconds (e.g., 300).

## 📧 Gmail

Integrate with Google Mail to send and read messages.

### Triggers

#### `newEmail`
- **Description:** Fires when a new email is received in the inbox.
- **Parameters:** (None)

### Actions

#### `sendEmail`
- **Description:** Sends a new email.
- **Parameters:**
  - `to` (string): Recipient email address.
  - `subject` (string): Email subject line.
  - `body` (string): Email body content (supports HTML).

#### `listMessages`
- **Description:** Lists recent emails.
- **Parameters:**
  - `maxResults` (number): Maximum number of messages to return (default: 10).
  - `q` (string): Gmail search query (e.g., from:someone@gmail.com).

## 📊 Google Sheets

Perform operations on Google Spreadsheets.

### Actions

#### `appendRow`
- **Description:** Appends a row of values to the end of a sheet.
- **Parameters:**
  - `spreadsheetId` (string): The ID of the spreadsheet.
  - `range` (string): The sheet name or range (e.g., Sheet1!A1).
  - `values` (array): List of values for the row (e.g., ["Data 1", "Data 2"]).

#### `appendRowSmart`
- **Description:** Similar to `appendRow`, but automatically creates the worksheet if it doesn't exist.
- **Parameters:** Same as `appendRow`.

#### `getValues`
- **Description:** Retrieves values from a specific range.
- **Parameters:**
  - `spreadsheetId` (string): The ID of the spreadsheet.
  - `range` (string): The range to read (e.g., Sheet1!A1:B10).

#### `createSpreadsheet`
- **Description:** Creates a brand new spreadsheet.
- **Parameters:**
  - `title` (string): Title of the new spreadsheet.

## 📂 Google Drive

Manage files and folders in Google Drive.

### Actions

#### `listFiles`
- **Description:** Lists files in the user's Drive.
- **Parameters:**
  - `pageSize` (number): Number of files to return (default: 10).

#### `createFolder`
- **Description:** Creates a new folder.
- **Parameters:**
  - `name` (string): Name of the new folder.

## 📝 Google Docs

Create and modify Google Documents.

### Actions

#### `createDocument`
- **Description:** Creates a new Google Doc.
- **Parameters:**
  - `title` (string): Title of the new document.

#### `appendText`
- **Description:** Appends text to an existing document.
- **Parameters:**
  - `documentId` (string): The ID of the document.
  - `text` (string): The text content to append.
