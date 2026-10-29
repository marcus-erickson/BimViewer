---
name: analyze-bim-file
description: Analyze an attached or named Revit (.rvt) or IFC (.ifc) file and publish a viewer page with its results and an Ask Claude chat.
---

# Analyze a BIM file

Turn a Revit (.rvt) or IFC (.ifc) file into a finished viewer page that opens already showing the file's results, with an Ask Claude chat on top. The page is the BimViewer tool (github.com/marcus-erickson/BimViewer) loaded with a snapshot of the file. In this mode the page heading is the file name, with no intro text, and the Open buttons stay available.

The user decides whether a new analysis replaces an earlier page or gets a page of its own, so the gallery only fills up if they want it to.

## 1. Get the file

- If the user attached a file, use it. Attachments are under /mnt/user-data/uploads/. Upload names can carry a random prefix such as `149b22b9-`; the snapshot command removes it from the displayed name.
- If the user named a file on their computer and the desktop link tools are present, stage it with the device tools, then use the staged copy.
- If there is no file, ask one question: "Which Revit or IFC file should I analyze? You can attach it here." Then wait.
- If the file is not .rvt or .ifc, say this skill handles only those two for now. If it is a scan folder (folders of x y z r g b text files), say scan folders are not supported by this skill yet and point to the viewer page, which loads scan folders in the browser.

## 2. Set up the tool

Work in a new empty directory in the scratchpad.

```
git clone --depth 1 https://github.com/marcus-erickson/BimViewer.git repo
```

If the clone fails, call the add_repo tool for marcus-erickson/BimViewer and use the clone command it returns. The tool needs only Node and Python 3. Do not run npm install; the pako library is bundled in the repo.

## 3. Build the snapshot and the page

Run from inside the cloned repo, with the file path as an argument:

```
node tools/snapshot.js "<path to file>" ../snapshot.json
python3 build.py --snapshot ../snapshot.json --fragment ../page.html
```

Read the cleaned file name from the `name` field of ../snapshot.json. In ../page.html, change the first `<title>BIM File Viewer</title>` to `<title>BIM File Viewer: <that name without its extension></title>` so each analysis is easy to find in the gallery.

If snapshot.js reports it could not read the file, tell the user plainly and stop. Revit files saved by very old or very new versions can fail to parse.

## 4. Ask whether to replace or add

Use the Artifact tool's list action and look for artifacts whose title starts with "BIM File Viewer:".

- If there are none, publish as a new artifact and skip the question.
- If there is at least one, ask one question with the AskUserQuestion tool: "You already have an analysis page. Replace it, or keep it and make a new page?" Offer "Replace <existing title>" for each existing page (at most three, most recent first) and "Make a new page".

If the user replaces a page, read it with the Artifact read action, then publish ../page.html with that artifact's `url` so the link stays the same. If they choose a new page, publish without a `url`. If the user cannot be asked (an unattended run), make a new page and say so.

## 5. Publish

Publish with `capabilities: {"sample": {}}` so the Ask Claude chat works, icon "building", and a one-sentence description such as "BIM File Viewer for <file name> with Ask Claude chat." Do not hand-edit or restyle the page.

## 6. Tell the user what they got

After publishing, write a short reply:

- One sentence saying the page is ready and opens on the file's Overview, and whether it replaced an earlier page or is a new one.
- Two or three findings pulled from the snapshot, for example the readiness result for a Revit file or the classes with the lowest material or type coverage for an IFC. State only numbers that appear in the snapshot.
- One line that Ask Claude is on the left menu, uses their own Claude account, and asks permission the first time.
- One line of caution: the page contains the file's facts (name, size, project information, and for Revit the names found inside it), the link is private until they share it, a link that was shared will show the new analysis if a page was replaced, and anyone they share it with uses their own Claude usage when they ask a question.
- For a Revit file, add that element counts cannot be read from .rvt, and suggest exporting an IFC for element-level data.

Do not paste the link; the app shows a card with it.

## Style

Plain sentences, no em dashes, no strings of very short sentences, no flattery.
