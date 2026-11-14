import { useRead } from "@/lib/hooks";
import { filterBySplit } from "mogh_ui";
import { Prune } from "@/resources/server/executions";
import DockerBatchExecutions from "./batch-executions";
import { ICONS } from "@/lib/icons";
import { Section, SectionProps } from "mogh_ui";
import { ShowHideButton } from "mogh_ui";
import { Group, Text } from "@mantine/core";
import { Types } from "komodo_client";
import { SearchInput } from "mogh_ui";
import ContainersTable from "./containers-table";
import {
  ComposeProjectGroups,
  ContainersViewToggle,
  useContainersView,
} from "./container-groups";

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
  /** Offers the grouped view, which is the default. It needs at least
   * one container with a Compose project reported by its Periphery. */
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
  const [view] = useContainersView();
  const canGroup =
    groupByComposeProject &&
    containers.some((container) => container.compose_project);
  const showGroups = canGroup && view === "Grouped";
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
                {canGroup && <ContainersViewToggle />}
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
            filtered.length ? (
              <ComposeProjectGroups
                containers={filtered}
                serverId={serverId}
                selectable={selectable}
                searching={!!_search?.[0]}
              />
            ) : (
              <Text c="dimmed">No containers match your search.</Text>
            )
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
