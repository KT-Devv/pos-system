use serde::{Deserialize, Serialize};
use tauri::State;
use tauri_plugin_sql::{Migration, MigrationKind, Db};

#[derive(Debug, Deserialize)]
pub struct SaleLine {
    pub product_id: String,
    pub quantity: i64,
}

#[derive(Debug, Deserialize)]
pub struct OfflineSale {
    pub id: String,
    pub cashier_id: String,
    pub customer_id: Option<String>,
    pub payment_method: String,
    pub discount: i64,
    pub lines: Vec<SaleLine>,
}

#[derive(Debug, Serialize)]
pub struct QueueResult {
    pub queued: bool,
    pub id: String,
}

#[tauri::command]
async fn queue_sale(db: State<'_, Db>, sale: OfflineSale) -> Result<QueueResult, String> {
    if sale.lines.is_empty() {
        return Err("A sale must contain at least one line".into());
    }
    if sale.lines.iter().any(|line| line.quantity <= 0) {
        return Err("Sale quantities must be positive".into());
    }

    let payload = serde_json::to_string(&sale).map_err(|error| error.to_string())?;
    db.execute(
        "INSERT INTO offline_operations (id, operation_type, payload, attempts) VALUES (?1, 'sale', ?2, 0)",
        vec![sale.id.clone().into(), payload.into()],
    ).await.map_err(|error| error.to_string())?;

    Ok(QueueResult { queued: true, id: sale.id })
}

#[tauri::command]
async fn pending_operations(db: State<'_, Db>) -> Result<Vec<serde_json::Value>, String> {
    db.select("SELECT id, operation_type, payload, attempts, created_at FROM offline_operations ORDER BY created_at ASC")
        .await.map_err(|error| error.to_string())
}

#[tauri::command]
async fn remove_operation(db: State<'_, Db>, id: String) -> Result<(), String> {
    db.execute("DELETE FROM offline_operations WHERE id = ?1", vec![id.into()])
        .await.map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "create offline operation queue",
        sql: "CREATE TABLE IF NOT EXISTS offline_operations (id TEXT PRIMARY KEY, operation_type TEXT NOT NULL, payload TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().add_migrations("sqlite:pos.db", migrations).build())
        .invoke_handler(tauri::generate_handler![queue_sale, pending_operations, remove_operation])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
