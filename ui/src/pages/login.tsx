import { LoginPage } from "mogh_ui";
import { useUserInvalidate } from "@/lib/hooks";
import { appName } from "@/lib/instance-theme";

export default function Login(props: {
  passkeyIsPending?: boolean;
  totpIsPending?: boolean;
}) {
  const userInvalidate = useUserInvalidate();
  return (
    <LoginPage
      {...props}
      appName={appName()}
      iconLink="/mogh-512x512.png"
      iconLinkAlt="moghtech"
      exampleConfigLink="https://github.com/moghtech/komodo/blob/main/config/core.config.toml"
      onLogin={userInvalidate}
    />
  );
}
