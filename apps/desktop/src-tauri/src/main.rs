// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::Emitter;

/// Write-to-temp, fsync, rename-over. Crash-safe file writes.
#[tauri::command]
async fn save_scene_atomic(path: String, content: String) -> Result<(), String> {
    let tmp = format!("{}.tmp", path);
    tokio::fs::write(&tmp, &content)
        .await
        .map_err(|e| format!("write tmp: {e}"))?;

    let f = tokio::fs::File::open(&tmp)
        .await
        .map_err(|e| format!("open tmp: {e}"))?;
    f.sync_all()
        .await
        .map_err(|e| format!("fsync: {e}"))?;
    drop(f);

    tokio::fs::rename(&tmp, &path)
        .await
        .map_err(|e| format!("rename: {e}"))?;

    Ok(())
}

fn main() {
    if let Err(e) = tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![save_scene_atomic])
        .setup(|app| {
            // ── Native menu ───────────────────────────────────────────
            let file_menu = SubmenuBuilder::new(app, "File")
                .item(&MenuItemBuilder::with_id("new", "New").accelerator("CmdOrCtrl+N").build(app)?)
                .item(&MenuItemBuilder::with_id("open", "Open…").accelerator("CmdOrCtrl+O").build(app)?)
                .separator()
                .item(&MenuItemBuilder::with_id("save", "Save").accelerator("CmdOrCtrl+S").build(app)?)
                .item(&MenuItemBuilder::with_id("save_as", "Save As…").accelerator("CmdOrCtrl+Shift+S").build(app)?)
                .separator()
                .item(&MenuItemBuilder::with_id("export", "Export…").accelerator("CmdOrCtrl+E").build(app)?)
                .separator()
                .item(&MenuItemBuilder::with_id("quit", "Quit").accelerator("CmdOrCtrl+Q").build(app)?)
                .build()?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .item(&MenuItemBuilder::with_id("undo", "Undo").accelerator("CmdOrCtrl+Z").build(app)?)
                .item(&MenuItemBuilder::with_id("redo", "Redo").accelerator("CmdOrCtrl+Shift+Z").build(app)?)
                .separator()
                .item(&MenuItemBuilder::with_id("copy", "Copy").accelerator("CmdOrCtrl+C").build(app)?)
                .item(&MenuItemBuilder::with_id("paste", "Paste").accelerator("CmdOrCtrl+V").build(app)?)
                .item(&MenuItemBuilder::with_id("duplicate", "Duplicate Sprite").accelerator("CmdOrCtrl+D").build(app)?)
                .separator()
                .item(&MenuItemBuilder::with_id("delete", "Delete").build(app)?)
                .build()?;

            let view_menu = SubmenuBuilder::new(app, "View")
                .item(&MenuItemBuilder::with_id("toggle_loop", "Toggle Loop").build(app)?)
                .separator()
                .item(&MenuItemBuilder::with_id("prefs", "Preferences…").build(app)?)
                .build()?;

            let help_menu = SubmenuBuilder::new(app, "Help")
                .item(&MenuItemBuilder::with_id("shortcuts", "Keyboard Shortcuts").build(app)?)
                .item(&MenuItemBuilder::with_id("about", "About Cel").build(app)?)
                .build()?;

            let menu = MenuBuilder::new(app)
                .items(&[&file_menu, &edit_menu, &view_menu, &help_menu])
                .build()?;

            app.set_menu(menu)?;

            // Forward menu events to the frontend
            app.on_menu_event(move |app_handle, event| {
                let _ = app_handle.emit("menu-action", event.id().0.as_str());
            });

            Ok(())
        })
        .run(tauri::generate_context!())
    {
        eprintln!("Application error: {e}");
        std::process::exit(1);
    }
}
