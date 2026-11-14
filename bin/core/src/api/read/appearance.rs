use komodo_client::api::read::*;
use mogh_resolver::Resolve;

use crate::appearance::appearance;

use super::ReadArgs;

impl Resolve<ReadArgs> for GetAppearance {
  async fn resolve(
    self,
    _: &ReadArgs,
  ) -> mogh_error::Result<GetAppearanceResponse> {
    Ok(appearance().as_ref().clone())
  }
}
