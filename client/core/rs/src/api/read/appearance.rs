use mogh_resolver::Resolve;
use serde::{Deserialize, Serialize};
use typeshare::typeshare;

use crate::entities::appearance::Appearance;

use super::KomodoReadRequest;

//

#[cfg(feature = "utoipa")]
#[utoipa::path(
  post,
  path = "/GetAppearance",
  description = "Get the instance appearance in effect.",
  request_body(content = GetAppearance),
  responses(
    (status = 200, description = "The appearance", body = GetAppearanceResponse),
  ),
)]
pub fn get_appearance() {}

/// Get the instance appearance in effect, and which of its settings
/// the environment controls. Response: [Appearance].
#[typeshare]
#[derive(Serialize, Deserialize, Debug, Clone, Default, Resolve)]
#[cfg_attr(feature = "utoipa", derive(utoipa::ToSchema))]
#[empty_traits(KomodoReadRequest)]
#[response(GetAppearanceResponse)]
#[error(mogh_error::Error)]
pub struct GetAppearance {}

#[typeshare]
pub type GetAppearanceResponse = Appearance;
