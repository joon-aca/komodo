use axum::{Json, http::header, response::IntoResponse};
use komodo_client::entities::config::core::UiTheme;
use serde::Serialize;

use crate::appearance::appearance;

/// Public presentation settings only. Do not expose CoreConfig here.
#[derive(Serialize)]
pub(super) struct UiConfig<'a> {
  theme: UiTheme,
  instance_name: &'a str,
}

pub(super) async fn config() -> impl IntoResponse {
  // Held in memory: this route is public and never reads the database.
  let appearance = appearance();
  (
    [(header::CACHE_CONTROL, "no-store")],
    Json(UiConfig {
      theme: appearance.ui_theme,
      instance_name: &appearance.ui_instance_name,
    })
    .into_response(),
  )
}
