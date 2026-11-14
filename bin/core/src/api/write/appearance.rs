use anyhow::anyhow;
use komodo_client::{
  api::write::*,
  entities::{Operation, ResourceTarget},
};
use mogh_error::AddStatusCodeError;
use mogh_resolver::Resolve;
use reqwest::StatusCode;

use crate::{
  appearance::{SaveAppearanceError, save_appearance},
  helpers::update::{add_update, make_update},
};

use super::WriteArgs;

impl Resolve<WriteArgs> for UpdateAppearance {
  #[instrument(
    "UpdateAppearance",
    skip_all,
    fields(
      operator = user.id,
      ui_theme = format!("{:?}", self.ui_theme),
      ui_instance_name = self.ui_instance_name,
    )
  )]
  async fn resolve(
    self,
    WriteArgs { user }: &WriteArgs,
  ) -> mogh_error::Result<UpdateAppearanceResponse> {
    if !user.admin {
      return Err(
        anyhow!("Only Admins can update the appearance")
          .status_code(StatusCode::FORBIDDEN),
      );
    }

    let (before, after) =
      save_appearance(self.ui_theme, self.ui_instance_name)
        .await
        .map_err(|e| match e {
          SaveAppearanceError::Invalid(reason) => {
            anyhow!(reason).status_code(StatusCode::BAD_REQUEST)
          }
          SaveAppearanceError::Failed(e) => e.into(),
        })?;

    if before == after {
      return Ok(after.as_ref().clone());
    }

    let mut update = make_update(
      ResourceTarget::system(),
      Operation::UpdateAppearance,
      user,
    );
    update.push_simple_log(
      "Update Appearance",
      format!(
        "palette: {:?} => {:?}\nname: {:?} => {:?}",
        before.ui_theme,
        after.ui_theme,
        before.ui_instance_name,
        after.ui_instance_name,
      ),
    );
    update.finalize();
    add_update(update).await?;

    Ok(after.as_ref().clone())
  }
}
