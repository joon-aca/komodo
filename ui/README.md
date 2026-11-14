# Komodo UI

Komodo UI uses Yarn + Vite + React + Mantine UI

## Setup Dev Environment

The UI depends on the local package `komodo_client` located at `/client/core/ts`.
This must first be built and prepared for yarn link.

The following command should setup everything up (run with /ui as working directory):

```sh
cd ../client/core/ts && yarn && yarn build && yarn link && \
cd ../../../ui && yarn link komodo_client && yarn
```

You can make a new file `.env.development` (gitignored) which holds:
```sh
VITE_KOMODO_HOST=https://demo.komo.do
```
You can point it to any Komodo host you like, including the demo.

Now you can start the dev ui server:
```sh
yarn dev
```

## Instance background palettes

Set `KOMODO_UI_THEME` on **Core** to `blue` or `violet` to distinguish instances
by their canvas, navigation, panels, inputs and dialogs. The same color family
applies on login and in both light and dark mode. Users can still select light,
dark or automatic mode using the existing theme menu.

For example, in the Core service's Compose environment:

```yaml
environment:
  KOMODO_UI_THEME: blue
```

Alternatively, set `ui_theme = "blue"` in the Core configuration file. The
environment variable overrides the file. Restart Core and reload the browser to
apply a change. Use `default` or remove the setting to restore the stock palette.
Unknown configuration values are rejected at Core startup.

The UI reads the palette from public `GET /ui-config` before rendering, without
authentication or browser palette storage. The response contains only the preset
name and uses `Cache-Control: no-store`. If the request fails, takes more than two
seconds, or returns an unsupported value (including an older Core's HTML fallback),
the UI starts with stock colors. Development UI pointed at `VITE_KOMODO_HOST`
reads that Core's palette as well.

Status, tag and destructive-action colors retain their existing meanings. This
setting does not customize logos or favicons.

## Instance name

Set `KOMODO_UI_INSTANCE_NAME` on **Core** (or `ui_instance_name` in the Core
configuration file) to name an instance, for example `Leia`. The name appears
on the login page as `KOMODO · Leia` and beside the logo in the header. It is
trimmed, limited to 40 characters, and Core refuses to start with a longer
value. Leave it empty for the stock login page and header.

The name is part of the public `GET /ui-config` response, so anyone who can
reach the login page can read it. `KOMODO_TITLE` keeps its existing
browser-title behavior and is independent of this setting.

## Appearance settings

An admin can change the instance name and the palette in **Settings →
Appearance** without restarting Core. The tab shows each palette in light and
dark mode. Saving reloads the page; other open sessions change on their next
load. Non-admins do not see the tab and Core refuses their requests.

Each setting is resolved separately, in this order:

1. The environment variable (`KOMODO_UI_THEME`, `KOMODO_UI_INSTANCE_NAME`).
2. The value saved in Settings.
3. The Core configuration file.
4. The stock appearance.

A setting the environment controls is shown as locked in the tab, and Core
refuses to save it. Remove the variable and restart Core to change it in
Settings. A setting that was never saved keeps following the configuration
file.

Saved values are stored as one document in the `Settings` database
collection. Core reads it at startup and keeps the result in memory, so
`GET /ui-config` does not query the database. An older Core ignores the
collection: before downgrading, set both environment variables so the
instance keeps its identity.
