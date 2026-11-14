use mogh_resolver::Resolve;
use serde::{Deserialize, Serialize};
use typeshare::typeshare;

use crate::entities::{
  appearance::Appearance, config::core::UiTheme,
};

use super::KomodoWriteRequest;

//

#[cfg(feature = "utoipa")]
#[utoipa::path(
  post,
  path = "/UpdateAppearance",
  description = "**Admin only.** Update the instance appearance.",
  request_body(content = UpdateAppearance),
  responses(
    (status = 200, description = "The appearance in effect", body = UpdateAppearanceResponse),
  ),
)]
pub fn update_appearance() {}

/// **Admin only.** Save the instance appearance. Response: [Appearance].
///
/// Omit a field to leave it as it is. A field the environment
/// controls cannot be set and the request is refused.
#[typeshare]
#[derive(Debug, Clone, Default, Serialize, Deserialize, Resolve)]
#[cfg_attr(feature = "utoipa", derive(utoipa::ToSchema))]
#[empty_traits(KomodoWriteRequest)]
#[response(UpdateAppearanceResponse)]
#[error(mogh_error::Error)]
pub struct UpdateAppearance {
  /// The instance background palette to save.
  pub ui_theme: Option<UiTheme>,
  /// The instance name to save, at most 40 characters.
  /// An empty name shows none.
  pub ui_instance_name: Option<String>,
}

#[typeshare]
pub type UpdateAppearanceResponse = Appearance;
