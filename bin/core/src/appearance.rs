//! The instance appearance: the background palette and the instance name.
//!
//! Each setting is resolved in this order: the environment variable, then
//! the value an admin saved in Settings, then the Core config file. The
//! result is kept in memory, so the public `/ui-config` route never reads
//! the database for an anonymous caller.

use std::sync::{Arc, OnceLock};

use anyhow::Context;
use arc_swap::ArcSwap;
use database::mungos::mongodb::{
  bson::{Document, doc, to_bson},
  options::UpdateOptions,
};
use komodo_client::entities::{
  appearance::{
    APPEARANCE_SETTINGS_NAME, Appearance, AppearanceSettings,
  },
  config::core::{CoreConfig, UiTheme, validate_ui_instance_name},
};

use crate::{
  config::{UiEnvOverrides, core_config, ui_env_overrides},
  state::db_client,
};

fn appearance_store() -> &'static ArcSwap<Appearance> {
  static APPEARANCE: OnceLock<ArcSwap<Appearance>> = OnceLock::new();
  APPEARANCE.get_or_init(|| {
    // Until the saved settings are loaded, the environment and file apply.
    ArcSwap::from_pointee(resolve_appearance(
      core_config(),
      ui_env_overrides(),
      None,
    ))
  })
}

/// The appearance in effect. Never reads the database.
pub fn appearance() -> Arc<Appearance> {
  appearance_store().load_full()
}

/// `config` already holds the environment value where one is set, so the
/// saved value only applies to a setting the environment leaves alone.
fn resolve_appearance(
  config: &CoreConfig,
  env: UiEnvOverrides,
  saved: Option<&AppearanceSettings>,
) -> Appearance {
  let saved_theme = saved.and_then(|saved| saved.ui_theme);
  let saved_name =
    saved.and_then(|saved| saved.ui_instance_name.as_deref());
  Appearance {
    ui_theme: match saved_theme {
      Some(theme) if !env.theme => theme,
      _ => config.ui_theme,
    },
    ui_instance_name: match saved_name {
      Some(name) if !env.instance_name => name.to_string(),
      _ => config.ui_instance_name.clone(),
    },
    ui_theme_from_env: env.theme,
    ui_instance_name_from_env: env.instance_name,
  }
}

async fn find_saved_appearance()
-> anyhow::Result<Option<AppearanceSettings>> {
  let Some(mut saved) = db_client()
    .settings
    .find_one(doc! { "name": APPEARANCE_SETTINGS_NAME })
    .await
    .context("Failed to query db for the saved appearance")?
  else {
    return Ok(None);
  };
  // The document can be edited outside of Core. Apply the same limit
  // as every other source, and fall back for a name that breaks it.
  if let Some(name) = saved.ui_instance_name.take() {
    match validate_ui_instance_name(&name) {
      Ok(name) => saved.ui_instance_name = Some(name),
      Err(e) => warn!(
        "Ignoring the saved instance name, using the config value | {e}"
      ),
    }
  }
  Ok(Some(saved))
}

async fn refresh_appearance() -> anyhow::Result<Arc<Appearance>> {
  let saved = find_saved_appearance().await?;
  let appearance = Arc::new(resolve_appearance(
    core_config(),
    ui_env_overrides(),
    saved.as_ref(),
  ));
  debug!("Resolved appearance | saved: {saved:?} | {appearance:?}");
  appearance_store().store(appearance.clone());
  Ok(appearance)
}

/// Must be called in app startup sequence, after the database client is
/// ready. The appearance is presentation only, so a failure to read it
/// leaves the environment and file values in effect instead of stopping
/// Core.
pub async fn load_saved_appearance() {
  match refresh_appearance().await {
    Ok(appearance) => info!(
      "Instance appearance | palette: {:?} | name: {:?}",
      appearance.ui_theme, appearance.ui_instance_name
    ),
    Err(e) => warn!(
      "Failed to load the saved appearance, using the environment and config file values | {e:#}"
    ),
  }
}

/// The reason a setting cannot be saved while its variable is set.
fn env_controlled(setting: &str, variable: &str) -> String {
  format!(
    "The {setting} is set by {variable} in the Core environment. Remove the variable to change it here."
  )
}

/// Checks a requested change against the settings the environment
/// controls, and builds the fields to save. `None` leaves a field as it is.
fn appearance_update(
  env: UiEnvOverrides,
  ui_theme: Option<UiTheme>,
  ui_instance_name: Option<String>,
) -> Result<Document, String> {
  let mut set = Document::new();
  if let Some(theme) = ui_theme {
    if env.theme {
      return Err(env_controlled("color palette", "KOMODO_UI_THEME"));
    }
    let theme = to_bson(&theme).map_err(|e| e.to_string())?;
    set.insert("ui_theme", theme);
  }
  if let Some(name) = ui_instance_name {
    if env.instance_name {
      return Err(env_controlled(
        "instance name",
        "KOMODO_UI_INSTANCE_NAME",
      ));
    }
    set.insert("ui_instance_name", validate_ui_instance_name(&name)?);
  }
  Ok(set)
}

/// Why a requested change was not saved.
pub enum SaveAppearanceError {
  /// The request itself is not acceptable.
  Invalid(String),
  Failed(anyhow::Error),
}

/// Saves the given fields and puts the result into effect.
/// Returns the appearance before and after the change.
pub async fn save_appearance(
  ui_theme: Option<UiTheme>,
  ui_instance_name: Option<String>,
) -> Result<(Arc<Appearance>, Arc<Appearance>), SaveAppearanceError> {
  let set =
    appearance_update(ui_env_overrides(), ui_theme, ui_instance_name)
      .map_err(SaveAppearanceError::Invalid)?;
  let before = appearance();
  if set.is_empty() {
    return Ok((before.clone(), before));
  }
  db_client()
    .settings
    .update_one(
      doc! { "name": APPEARANCE_SETTINGS_NAME },
      doc! { "$set": set },
    )
    .with_options(UpdateOptions::builder().upsert(true).build())
    .await
    .context("Failed to save the appearance on db")
    .map_err(SaveAppearanceError::Failed)?;
  let after = refresh_appearance()
    .await
    .map_err(SaveAppearanceError::Failed)?;
  Ok((before, after))
}

#[cfg(test)]
mod tests {
  use super::*;

  fn config(theme: UiTheme, name: &str) -> CoreConfig {
    CoreConfig {
      ui_theme: theme,
      ui_instance_name: name.to_string(),
      ..Default::default()
    }
  }

  fn saved(
    theme: Option<UiTheme>,
    name: Option<&str>,
  ) -> AppearanceSettings {
    AppearanceSettings {
      name: APPEARANCE_SETTINGS_NAME.to_string(),
      ui_theme: theme,
      ui_instance_name: name.map(str::to_string),
    }
  }

  const NO_ENV: UiEnvOverrides = UiEnvOverrides {
    theme: false,
    instance_name: false,
  };
  const ALL_ENV: UiEnvOverrides = UiEnvOverrides {
    theme: true,
    instance_name: true,
  };

  #[test]
  fn stock_without_any_source() {
    let appearance =
      resolve_appearance(&CoreConfig::default(), NO_ENV, None);
    assert_eq!(appearance, Appearance::default());
  }

  #[test]
  fn config_applies_without_a_saved_document() {
    let appearance = resolve_appearance(
      &config(UiTheme::Blue, "File"),
      NO_ENV,
      None,
    );
    assert_eq!(appearance.ui_theme, UiTheme::Blue);
    assert_eq!(appearance.ui_instance_name, "File");
    assert!(!appearance.ui_theme_from_env);
    assert!(!appearance.ui_instance_name_from_env);
  }

  #[test]
  fn saved_wins_over_the_config_file() {
    let appearance = resolve_appearance(
      &config(UiTheme::Blue, "File"),
      NO_ENV,
      Some(&saved(Some(UiTheme::Violet), Some("Saved"))),
    );
    assert_eq!(appearance.ui_theme, UiTheme::Violet);
    assert_eq!(appearance.ui_instance_name, "Saved");
  }

  #[test]
  fn unsaved_field_falls_back_to_the_config_file() {
    let appearance = resolve_appearance(
      &config(UiTheme::Blue, "File"),
      NO_ENV,
      Some(&saved(None, Some("Saved"))),
    );
    assert_eq!(appearance.ui_theme, UiTheme::Blue);
    assert_eq!(appearance.ui_instance_name, "Saved");
  }

  #[test]
  fn saved_empty_name_and_stock_palette_are_choices() {
    let appearance = resolve_appearance(
      &config(UiTheme::Blue, "File"),
      NO_ENV,
      Some(&saved(Some(UiTheme::Default), Some(""))),
    );
    assert_eq!(appearance.ui_theme, UiTheme::Default);
    assert_eq!(appearance.ui_instance_name, "");
  }

  #[test]
  fn environment_wins_over_saved() {
    // The config passed in already holds the environment values.
    let appearance = resolve_appearance(
      &config(UiTheme::Blue, "Env"),
      ALL_ENV,
      Some(&saved(Some(UiTheme::Violet), Some("Saved"))),
    );
    assert_eq!(appearance.ui_theme, UiTheme::Blue);
    assert_eq!(appearance.ui_instance_name, "Env");
    assert!(appearance.ui_theme_from_env);
    assert!(appearance.ui_instance_name_from_env);
  }

  #[test]
  fn environment_is_per_setting() {
    let appearance = resolve_appearance(
      &config(UiTheme::Blue, "File"),
      UiEnvOverrides {
        theme: true,
        instance_name: false,
      },
      Some(&saved(Some(UiTheme::Violet), Some("Saved"))),
    );
    assert_eq!(appearance.ui_theme, UiTheme::Blue);
    assert_eq!(appearance.ui_instance_name, "Saved");
  }

  #[test]
  fn update_holds_only_the_given_fields() {
    let set = appearance_update(NO_ENV, None, None).unwrap();
    assert!(set.is_empty());

    let set =
      appearance_update(NO_ENV, Some(UiTheme::Violet), None).unwrap();
    assert_eq!(set, doc! { "ui_theme": "violet" });

    let set = appearance_update(
      NO_ENV,
      Some(UiTheme::Default),
      Some("  Leia  ".to_string()),
    )
    .unwrap();
    assert_eq!(
      set,
      doc! { "ui_theme": "default", "ui_instance_name": "Leia" }
    );

    // Clearing the name is saved as an empty name.
    let set =
      appearance_update(NO_ENV, None, Some(String::new())).unwrap();
    assert_eq!(set, doc! { "ui_instance_name": "" });
  }

  #[test]
  fn update_refuses_a_name_over_the_limit() {
    let too_long = "a".repeat(41);
    assert!(appearance_update(NO_ENV, None, Some(too_long)).is_err());
  }

  #[test]
  fn update_refuses_settings_the_environment_controls() {
    let error =
      appearance_update(ALL_ENV, Some(UiTheme::Violet), None)
        .unwrap_err();
    assert!(error.contains("KOMODO_UI_THEME"));
    let error =
      appearance_update(ALL_ENV, None, Some("Leia".to_string()))
        .unwrap_err();
    assert!(error.contains("KOMODO_UI_INSTANCE_NAME"));
    // The other setting can still be saved.
    assert!(
      appearance_update(
        UiEnvOverrides {
          theme: true,
          instance_name: false,
        },
        None,
        Some("Leia".to_string()),
      )
      .is_ok()
    );
  }
}
