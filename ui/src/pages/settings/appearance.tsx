import { useRead, useSetTitle, useWrite } from "@/lib/hooks";
import {
  INSTANCE_NAME_MAX_CHARS,
  INSTANCE_THEME_OPTIONS,
  InstanceTheme,
} from "@/lib/instance-theme";
import {
  Box,
  Button,
  Group,
  Radio,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Types } from "komodo_client";
import { useState } from "react";

export default function SettingsAppearance() {
  useSetTitle("Appearance");
  const appearance = useRead("GetAppearance", {}).data;
  // The form takes its initial values from the response.
  return appearance ? <AppearanceForm appearance={appearance} /> : null;
}

function AppearanceForm({ appearance }: { appearance: Types.Appearance }) {
  const [name, setName] = useState(appearance.ui_instance_name);
  const [theme, setTheme] = useState<InstanceTheme>(appearance.ui_theme);
  const { mutate: save, isPending } = useWrite("UpdateAppearance", {
    onSuccess: () => {
      notifications.show({ message: "Appearance saved", color: "green" });
      // The palette and name are resolved once, before the app renders.
      window.location.reload();
    },
  });

  // Send only what changed. Core refuses a setting the environment controls.
  const changes: Types.UpdateAppearance = {};
  if (!appearance.ui_instance_name_from_env) {
    const trimmed = name.trim();
    if (trimmed !== appearance.ui_instance_name) {
      changes.ui_instance_name = trimmed;
    }
  }
  if (!appearance.ui_theme_from_env && theme !== appearance.ui_theme) {
    changes.ui_theme = theme as Types.UiTheme;
  }
  const changed = Object.keys(changes).length > 0;

  return (
    <Stack gap="xl" maw={720}>
      <TextInput
        label="Instance name"
        description={
          appearance.ui_instance_name_from_env ? (
            <SetByEnvironment variable="KOMODO_UI_INSTANCE_NAME" />
          ) : (
            "Shown on the login page and beside the logo. Anyone who can reach the login page can read it."
          )
        }
        placeholder="Unnamed"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={INSTANCE_NAME_MAX_CHARS}
        disabled={appearance.ui_instance_name_from_env}
        rightSectionWidth={64}
        rightSection={
          <Text size="xs" c="dimmed">
            {Array.from(name.trim()).length}/{INSTANCE_NAME_MAX_CHARS}
          </Text>
        }
      />

      <Radio.Group
        label="Color palette"
        description={
          appearance.ui_theme_from_env ? (
            <SetByEnvironment variable="KOMODO_UI_THEME" />
          ) : (
            "The background color family for everyone using this instance, in light and dark mode."
          )
        }
        value={theme}
        onChange={(value) => setTheme(value as InstanceTheme)}
      >
        <SimpleGrid cols={{ base: 1, sm: 3 }} mt="sm">
          {INSTANCE_THEME_OPTIONS.map((option) => (
            <Radio.Card
              key={option.value}
              value={option.value}
              disabled={appearance.ui_theme_from_env}
              radius="md"
              p="md"
              // The palette's own accent is too faint to mark the choice.
              style={
                option.value === theme
                  ? { borderColor: "var(--mantine-color-green-filled)" }
                  : undefined
              }
            >
              <Stack gap="sm">
                <Group gap="sm" wrap="nowrap">
                  <Radio.Indicator color="green" />
                  <Text fw={500}>{option.label}</Text>
                </Group>
                <Group gap="xs" grow>
                  <Swatch mode="Light" color={option.light} />
                  <Swatch mode="Dark" color={option.dark} />
                </Group>
              </Stack>
            </Radio.Card>
          ))}
        </SimpleGrid>
      </Radio.Group>

      <Group>
        <Button
          onClick={() => save(changes)}
          disabled={!changed}
          loading={isPending}
        >
          Save
        </Button>
        <Text size="sm" c="dimmed">
          Saving reloads this page. Other open sessions change on their next
          load.
        </Text>
      </Group>
    </Stack>
  );
}

function SetByEnvironment({ variable }: { variable: string }) {
  return (
    <>
      Set by <code>{variable}</code> in the Core environment. Remove the
      variable to change it here.
    </>
  );
}

/** The page color of a palette in one mode, whatever mode the viewer uses. */
function Swatch({ mode, color }: { mode: "Light" | "Dark"; color: string }) {
  return (
    <Box
      bg={color}
      c={mode === "Light" ? "dark.9" : "gray.0"}
      bd="1px solid var(--mantine-color-default-border)"
      bdrs="sm"
      px="xs"
      py={6}
      fz="xs"
      ta="center"
    >
      {mode}
    </Box>
  );
}
