use serde::{Deserialize, Serialize};
use tauri::State;
use tauri_plugin_sql::{DbInstances, DbPool, Migration, MigrationKind};
use sqlx::Row;

#[derive(Debug, Deserialize, Serialize)]
pub struct SaleLine {
    pub product_id: String,
    pub quantity: i64,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct OfflineSale {
    pub id: String,
    /// The shop the sale was rung up in; it is only ever synchronised to that shop.
    pub shop_id: String,
    pub cashier_id: String,
    pub customer_id: Option<String>,
    pub payment_method: String,
    pub discount: f64,
    pub lines: Vec<SaleLine>,
}

#[derive(Debug, Serialize)]
pub struct QueueResult {
    pub queued: bool,
    pub id: String,
}

async fn database(state: &State<'_, DbInstances>) -> Result<sqlx::SqlitePool, String> {
    let instances = state.0.read().await;
    match instances.get("sqlite:pos.db") {
        Some(DbPool::Sqlite(pool)) => Ok(pool.clone()),
        _ => Err("Offline database is not loaded".into()),
    }
}

#[tauri::command]
async fn queue_sale(db: State<'_, DbInstances>, sale: OfflineSale) -> Result<QueueResult, String> {
    if sale.shop_id.trim().is_empty() {
        return Err("A sale must belong to a shop".into());
    }
    if sale.lines.is_empty() {
        return Err("A sale must contain at least one line".into());
    }
    if sale.lines.iter().any(|line| line.quantity <= 0) {
        return Err("Sale quantities must be positive".into());
    }

    let payload = serde_json::to_string(&sale).map_err(|error| error.to_string())?;
    let pool = database(&db).await?;
    sqlx::query("INSERT INTO offline_operations (id, operation_type, payload, attempts) VALUES (?1, 'sale', ?2, 0)")
        .bind(&sale.id)
        .bind(payload)
        .execute(&pool)
        .await
        .map_err(|error| error.to_string())?;

    Ok(QueueResult { queued: true, id: sale.id })
}

#[tauri::command]
async fn pending_operations(db: State<'_, DbInstances>) -> Result<Vec<serde_json::Value>, String> {
    let pool = database(&db).await?;
    let rows = sqlx::query("SELECT id, operation_type, payload, attempts, created_at FROM offline_operations ORDER BY created_at ASC")
        .fetch_all(&pool)
        .await
        .map_err(|error| error.to_string())?;
    Ok(rows.into_iter().map(|row| serde_json::json!({
        "id": row.get::<String, _>("id"),
        "operation_type": row.get::<String, _>("operation_type"),
        "payload": row.get::<String, _>("payload"),
        "attempts": row.get::<i64, _>("attempts"),
        "created_at": row.get::<String, _>("created_at"),
    })).collect())
}

#[tauri::command]
async fn remove_operation(db: State<'_, DbInstances>, id: String) -> Result<(), String> {
    let pool = database(&db).await?;
    sqlx::query("DELETE FROM offline_operations WHERE id = ?1")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
async fn increment_attempts(db: State<'_, DbInstances>, id: String) -> Result<(), String> {
    let pool = database(&db).await?;
    sqlx::query("UPDATE offline_operations SET attempts = attempts + 1 WHERE id = ?1")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|error| error.to_string())?;
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
        .invoke_handler(tauri::generate_handler![queue_sale, pending_operations, remove_operation, increment_attempts])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
