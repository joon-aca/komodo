import { atomWithStorage } from "@/lib/hooks";
import { containerStateIntention } from "@/lib/color";
import { Accordion, Group, SegmentedControl, Stack, Text } from "@mantine/core";
import { useAtom } from "jotai";
import { Types } from "komodo_client";
import { StatusBadge } from "mogh_ui";
import { useEffect, useState } from "react";
import ContainersTable, { ContainersTableProps } from "./containers-table";

const CONTAINERS_VIEWS = ["Grouped", "Flat"] as const;
export type ContainersView = (typeof CONTAINERS_VIEWS)[number];

const containersViewAtom = atomWithStorage<ContainersView>(
  "containers-view-v1",
  "Grouped",
);

/** The grouped / flat choice, shared by every containers list
 * and remembered on local storage. */
export function useContainersView() {
  return useAtom<ContainersView>(containersViewAtom);
}

export function ContainersViewToggle() {
  const [view, setView] = useContainersView();
  return (
    <SegmentedControl
      aria-label="Containers view"
      size="xs"
      data={[...CONTAINERS_VIEWS]}
      value={view}
      onChange={(view) => setView(view as ContainersView)}
    />
  );
}

const collapsedGroupsAtom = atomWithStorage<string[]>(
  "containers-collapsed-groups-v1",
  [],
);

export const serverGroupKey = (serverId: string) => `server:${serverId}`;
/** Scoped to the server, so the same project
 * name on two servers stays two groups. */
export const projectGroupKey = (serverId: string, project: string) =>
  `project:${serverId}:${project}`;

/**
 * Controlled `Accordion` state for the given group keys.
 * Groups are open unless collapsed, and the collapsed groups are
 * remembered on local storage. While searching every group starts open so
 * matches are never hidden, and collapsing only lasts for that search.
 */
export function useGroupAccordion(keys: string[], searching: boolean) {
  const [remembered, setRemembered] = useAtom<string[]>(collapsedGroupsAtom);
  const [duringSearch, setDuringSearch] = useState<string[]>([]);
  useEffect(() => {
    if (!searching) setDuringSearch([]);
  }, [searching]);

  const collapsed = searching ? duringSearch : remembered;
  const setCollapsed = searching ? setDuringSearch : setRemembered;
  return {
    value: keys.filter((key) => !collapsed.includes(key)),
    onChange: (open: string[]) =>
      setCollapsed([
        // Groups which are not currently listed keep their state.
        ...collapsed.filter((key) => !keys.includes(key)),
        ...keys.filter((key) => !open.includes(key)),
      ]),
  };
}

const CONTAINER_STATES = Object.values(Types.ContainerStateStatusEnum);

/** Container counts by state, so a stopped or unhealthy
 * container is visible while its group is collapsed. */
export function ContainerStateSummary({
  containers,
}: {
  containers: Types.ContainerListItem[];
}) {
  if (!containers.length) {
    return (
      <Text c="dimmed" size="sm">
        No containers
      </Text>
    );
  }
  return (
    <Group gap="xs">
      {CONTAINER_STATES.map((state) => {
        const count = containers.filter(
          (container) => container.state === state,
        ).length;
        return (
          count > 0 && (
            <StatusBadge
              key={state}
              // StatusBadge formats UpperCamelCase text.
              text={`${count} ${state ? state[0].toUpperCase() + state.slice(1) : "Unknown"}`}
              intent={containerStateIntention(state)}
            />
          )
        );
      })}
    </Group>
  );
}

export interface ComposeProjectGroupsProps extends Pick<
  ContainersTableProps,
  "serverId" | "containers" | "selectable"
> {
  /** A search is narrowing the containers. */
  searching: boolean;
}

/**
 * The containers of one server grouped by Compose project.
 * Containers without a reported project are listed after the projects,
 * directly under the server.
 */
export function ComposeProjectGroups({
  serverId,
  containers,
  selectable,
  searching,
}: ComposeProjectGroupsProps) {
  const projects = new Map<string, Types.ContainerListItem[]>();
  const standalone: Types.ContainerListItem[] = [];
  for (const container of containers) {
    const project = container.compose_project;
    if (!project) standalone.push(container);
    else if (projects.has(project)) projects.get(project)!.push(container);
    else projects.set(project, [container]);
  }
  const sorted = Array.from(projects).sort(([a], [b]) => a.localeCompare(b));
  const accordion = useGroupAccordion(
    sorted.map(([project]) => projectGroupKey(serverId, project)),
    searching,
  );

  return (
    <Stack>
      {sorted.length > 0 && (
        <Accordion multiple variant="contained" keepMounted={false} {...accordion}>
          {sorted.map(([project, containers]) => (
            <Accordion.Item
              key={project}
              value={projectGroupKey(serverId, project)}
            >
              <Accordion.Control>
                <Group justify="space-between" pr="sm">
                  <Text fw={500} style={{ overflowWrap: "anywhere" }}>
                    {project}
                  </Text>
                  <ContainerStateSummary containers={containers} />
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
          ))}
        </Accordion>
      )}
      {standalone.length > 0 && (
        <ContainersTable
          containers={standalone}
          serverId={serverId}
          selectable={selectable}
          grouped
        />
      )}
    </Stack>
  );
}
