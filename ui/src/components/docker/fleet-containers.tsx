import { ICONS } from "@/lib/icons";
import { ResourceComponents } from "@/resources";
import { usableResourcePath } from "@/lib/utils";
import { Accordion, ActionIcon, Group, Text } from "@mantine/core";
import { Types } from "komodo_client";
import { Link } from "react-router-dom";
import {
  ComposeProjectGroups,
  ContainerStateSummary,
  serverGroupKey,
  useGroupAccordion,
} from "./container-groups";

export interface FleetContainersProps {
  servers: Types.ServerListItem[];
  /** The containers of all the servers. */
  containers: Types.ContainerListItem[];
  /** Lowercase search terms. A container is shown when every term is
   * found in its server name, Compose project name or container name. */
  terms: string[];
}

/** Every container arranged as Server -> Compose project -> Container. */
export default function FleetContainers({
  servers,
  containers,
  terms,
}: FleetContainersProps) {
  const searching = terms.length > 0;
  const matches = (...names: (string | undefined)[]) => {
    const haystack = names.join(" ").toLowerCase();
    return terms.every((term) => haystack.includes(term));
  };
  const groups = servers
    .map((server) => ({
      server,
      containers: containers.filter(
        (container) =>
          container.server_id === server.id &&
          matches(server.name, container.compose_project, container.name),
      ),
    }))
    .filter(
      ({ server, containers }) =>
        !searching || containers.length > 0 || matches(server.name),
    )
    .sort((a, b) => a.server.name.localeCompare(b.server.name));
  const accordion = useGroupAccordion(
    groups.map(({ server }) => serverGroupKey(server.id)),
    searching,
  );

  if (!groups.length) {
    return (
      <Text c="dimmed">
        {searching ? "No containers match your search." : "No servers found."}
      </Text>
    );
  }

  return (
    <Accordion multiple variant="separated" keepMounted={false} {...accordion}>
      {groups.map(({ server, containers }) => (
        <Accordion.Item key={server.id} value={serverGroupKey(server.id)}>
          <Group wrap="nowrap" gap={0}>
            <Accordion.Control>
              <Group justify="space-between" pr="sm">
                <Group gap="xs" wrap="nowrap">
                  <ResourceComponents.Server.Icon id={server.id} />
                  <Text fw={600} style={{ overflowWrap: "anywhere" }}>
                    {server.name}
                  </Text>
                  {server.info.state !== Types.ServerState.Ok && (
                    <ResourceComponents.Server.State id={server.id} />
                  )}
                </Group>
                {server.info.state === Types.ServerState.Ok && (
                  <ContainerStateSummary containers={containers} />
                )}
              </Group>
            </Accordion.Control>
            <ActionIcon
              component={Link}
              to={`/${usableResourcePath("Server")}/${server.id}`}
              aria-label={`Open server ${server.name}`}
              title={`Open server ${server.name}`}
              variant="subtle"
              mr="sm"
            >
              <ICONS.ExternalLink size="1rem" />
            </ActionIcon>
          </Group>
          <Accordion.Panel>
            {containers.length > 0 ? (
              <ComposeProjectGroups
                serverId={server.id}
                containers={containers}
                selectable
                searching={searching}
              />
            ) : (
              <Text c="dimmed">{noContainersReason(server.info.state)}</Text>
            )}
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}

function noContainersReason(state: Types.ServerState) {
  switch (state) {
    case Types.ServerState.NotOk:
      return "Server unreachable. Its containers are not available.";
    case Types.ServerState.Disabled:
      return "Server disabled. Its containers are not available.";
    case Types.ServerState.Ok:
      return "No containers.";
  }
}
