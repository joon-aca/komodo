import { useDockerSelectionState, useRead } from "@/lib/hooks";
import { filterBySplit } from "mogh_ui";
import { Prune } from "@/resources/server/executions";
import DockerBatchExecutions from "./batch-executions";
import { ICONS } from "@/lib/icons";
import { DataTable, SortableHeader } from "mogh_ui";
import { Section, SectionProps } from "mogh_ui";
import { ShowHideButton } from "mogh_ui";
import { Accordion, Group, Switch, Text } from "@mantine/core";
import { useState } from "react";
import { Types } from "komodo_client";
import DockerResourceLink from "./link";
import { StatusBadge } from "mogh_ui";
import { containerStateIntention } from "@/lib/color";
import ContainerPorts from "@/components/docker/container-ports";
import { SearchInput } from "mogh_ui";
import { DividedChildren } from "mogh_ui";

export interface ContainersSectionProps extends SectionProps {
  serverId: string;
  containers: Types.ListContainersResponse;
  show?: boolean;
  setShow?: (show: boolean) => void;
  pruneButton?: boolean;
  forceTall?: boolean;
  _search?: [string, (search: string) => void];
  /** Enables multi select of containers for batch executions. */
  selectable?: boolean;
  groupByComposeProject?: boolean;
}

export default function ContainersSection({
  serverId,
  containers,
  show = true,
  setShow,
  pruneButton,
  forceTall,
  _search,
  selectable,
  groupByComposeProject,
  titleOther,
  ...sectionProps
}: ContainersSectionProps) {
  const [grouped, setGrouped] = useState(false);
  const canGroup =
    groupByComposeProject &&
    containers.some((container) => container.compose_project);
  const showGroups = canGroup && grouped;
  const allRunning = useRead("ListContainers", {
    server: serverId,
  }).data?.every(
    (container) => container.state === Types.ContainerStateStatusEnum.Running,
  );
  const filtered = _search
    ? filterBySplit(containers, _search[0], (container) =>
        showGroups
          ? `${container.name} ${container.compose_project ?? ""}`
          : container.name,
      )
    : containers;

  return (
    <Section
      titleOther={titleOther}
      title={!titleOther ? "Containers" : undefined}
      icon={!titleOther ? <ICONS.Container size="1.3rem" /> : undefined}
      {...sectionProps}
    >
      {show && (
        <>
          {(selectable ||
            (pruneButton && !allRunning) ||
            _search ||
            setShow ||
            canGroup) && (
            <Group justify="space-between">
              <Group>
                {canGroup && (
                  <Switch
                    label="Group by Compose project"
                    checked={grouped}
                    onChange={(event) =>
                      setGrouped(event.currentTarget.checked)
                    }
                  />
                )}
                {selectable && <DockerBatchExecutions type="Container" />}
                {pruneButton && !allRunning && (
                  <Prune serverId={serverId} type="Containers" />
                )}
              </Group>

              <Group>
                {_search && (
                  <SearchInput value={_search[0]} onSearch={_search[1]} />
                )}
                {setShow && <ShowHideButton show={show} setShow={setShow} />}
              </Group>
            </Group>
          )}

          {showGroups ? (
            <ComposeProjectGroups
              containers={filtered}
              serverId={serverId}
              selectable={selectable}
            />
          ) : (
            <ContainersTable
              containers={filtered}
              serverId={serverId}
              selectable={selectable}
              forceTall={forceTall}
            />
          )}
        </>
      )}
    </Section>
  );
}

type ContainersTableProps = Pick<
  ContainersSectionProps,
  "serverId" | "containers" | "selectable" | "forceTall"
>;

function ComposeProjectGroups({
  containers,
  serverId,
  selectable,
}: ContainersTableProps) {
  if (!containers.length) {
    return <Text c="dimmed">No containers match your search.</Text>;
  }

  const groups = new Map<string, Types.ListContainersResponse>();
  for (const container of containers) {
    const project = container.compose_project || "";
    const group = groups.get(project);
    if (group) group.push(container);
    else groups.set(project, [container]);
  }
  const projects = Array.from(groups).sort(
    ([a], [b]) => Number(!a) - Number(!b) || a.localeCompare(b),
  );

  return (
    <Accordion multiple variant="separated" keepMounted={false}>
      {projects.map(([project, containers]) => {
        const value = project ? `project:${project}` : "unreported";
        return (
          <Accordion.Item key={value} value={value}>
            <Accordion.Control>
              <Group justify="space-between">
                <Text fw={500}>{project || "No Compose project reported"}</Text>
                <Text c="dimmed" size="sm">
                  {containers.length}{" "}
                  {containers.length === 1 ? "container" : "containers"}
                </Text>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <ContainersTable
                containers={containers}
                serverId={serverId}
                selectable={selectable}
                grouped
              />
            </Accordion.Panel>
          </Accordion.Item>
        );
      })}
    </Accordion>
  );
}

function ContainersTable({
  containers,
  serverId,
  selectable,
  forceTall,
  grouped,
}: ContainersTableProps & { grouped?: boolean }) {
  const selectionState = useDockerSelectionState("Container");
  return (
    <DataTable
      mih={forceTall ? "60vh" : undefined}
      tableKey={grouped ? "server-containers-by-project" : "server-containers"}
      data={containers}
      selectOptions={
        selectable
          ? {
              selectKey: ({ name }) => `${serverId} ${name}`,
              state: selectionState,
            }
          : undefined
      }
      columns={[
        {
          accessorKey: "name",
          header: ({ column }) => (
            <SortableHeader column={column} title="Name" />
          ),
          cell: ({ row }) => (
            <DockerResourceLink
              type="Container"
              serverId={serverId}
              name={row.original.name}
            />
          ),
        },
        {
          accessorKey: "state",
          header: ({ column }) => (
            <SortableHeader column={column} title="State" />
          ),
          cell: ({ row }) => {
            const state = row.original?.state;
            return (
              <StatusBadge
                text={state}
                intent={containerStateIntention(state)}
              />
            );
          },
        },
        {
          accessorKey: "image",
          header: ({ column }) => (
            <SortableHeader column={column} title="Image" />
          ),
          cell: ({ row }) => (
            <DockerResourceLink
              type="Image"
              serverId={serverId}
              name={row.original.image}
              id={row.original.image_id}
            />
          ),
        },
        {
          accessorKey: "networks.0",
          header: ({ column }) => (
            <SortableHeader column={column} title="Networks" />
          ),
          cell: ({ row }) =>
            (row.original.networks?.length ?? 0) > 0 ? (
              <DividedChildren wrap="nowrap">
                {row.original.networks?.map((network) => (
                  <DockerResourceLink
                    key={network}
                    type="Network"
                    serverId={serverId}
                    name={network}
                  />
                ))}
              </DividedChildren>
            ) : (
              row.original.network_mode && (
                <DockerResourceLink
                  type="Network"
                  serverId={serverId}
                  name={row.original.network_mode}
                />
              )
            ),
        },
        {
          accessorKey: "ports.0",
          sortFn: (a, b) => {
            const getMinHostPort = (row: typeof a) => {
              const ports = row.original.ports ?? [];
              if (!ports.length) return Number.POSITIVE_INFINITY;
              const nums = ports
                .map((p) => p.PublicPort)
                .filter((p): p is number => typeof p === "number")
                .map((n) => Number(n));
              if (!nums.length || nums.some((n) => Number.isNaN(n))) {
                return Number.POSITIVE_INFINITY;
              }
              return Math.min(...nums);
            };
            const pa = getMinHostPort(a);
            const pb = getMinHostPort(b);
            return pa === pb ? 0 : pa > pb ? 1 : -1;
          },
          header: ({ column }) => (
            <SortableHeader column={column} title="Ports" />
          ),
          cell: ({ row }) => (
            <ContainerPorts
              ports={row.original.ports ?? []}
              serverId={row.original.server_id}
            />
          ),
        },
        {
          accessorKey: "volumes.0",
          header: ({ column }) => (
            <SortableHeader column={column} title="Volumes" />
          ),
          cell: ({ row }) => (
            <DividedChildren wrap="nowrap">
              {row.original.volumes?.map((volume) => (
                <DockerResourceLink
                  key={volume}
                  type="Volume"
                  serverId={row.original.server_id!}
                  name={volume}
                />
              ))}
            </DividedChildren>
          ),
        },
      ]}
    />
  );
}
