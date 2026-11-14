use serde::{Deserialize, Serialize};
use typeshare::typeshare;

use super::config::core::UiTheme;

/// The name of the single [AppearanceSettings] document.
pub const APPEARANCE_SETTINGS_NAME: &str = "appearance";

/// The appearance an admin saved in Settings. Stored as one document.
///
/// A field left as `None` has never been saved, and the value from the
/// Core config file applies instead.
#[derive(
  Serialize, Deserialize, Debug, Clone, Default, PartialEq,
)]
#[cfg_attr(
  feature = "mongo",
  derive(mongo_indexed::derive::MongoIndexed)
)]
#[cfg_attr(feature = "mongo", collection_name(Settings))]
pub struct AppearanceSettings {
  /// Always [APPEARANCE_SETTINGS_NAME].
  #[cfg_attr(feature = "mongo", unique_index)]
  pub name: String,
  /// The saved instance background palette.
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub ui_theme: Option<UiTheme>,
  /// The saved instance name. An empty name is a saved choice to show none.
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub ui_instance_name: Option<String>,
}

/// The appearance this instance currently shows, and which of its
/// settings the environment controls.
///
/// Each value is resolved in this order: the environment variable,
/// then the value saved in Settings, then the Core config file.
#[typeshare]
#[derive(
  Serialize, Deserialize, Debug, Clone, Default, PartialEq,
)]
#[cfg_attr(feature = "utoipa", derive(utoipa::ToSchema))]
pub struct Appearance {
  /// The instance background palette in effect.
  pub ui_theme: UiTheme,
  /// The instance name in effect. Empty when the instance is unnamed.
  pub ui_instance_name: String,
  /// `KOMODO_UI_THEME` is set. It overrides the saved palette,
  /// which cannot be changed until the variable is removed.
  pub ui_theme_from_env: bool,
  /// `KOMODO_UI_INSTANCE_NAME` is set. It overrides the saved name,
  /// which cannot be changed until the variable is removed.
  pub ui_instance_name_from_env: bool,
}
