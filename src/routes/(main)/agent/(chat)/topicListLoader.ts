import { BUILTIN_AGENT_SLUGS } from '@lobechat/builtin-agents';
import type { LoaderFunctionArgs } from 'react-router';

import { getSidebarTopicListParams } from '@/hooks/chatTopicListQuery';
import { PRE_PAINT_HYDRATE_TIMEOUT, settleWithin } from '@/libs/replica/prePaint';
import { useAgentStore } from '@/store/agent';
import { builtinAgentSelectors } from '@/store/agent/selectors';
import { useChatStore } from '@/store/chat';

const builtinAgentSlugs = new Set<string>(Object.values(BUILTIN_AGENT_SLUGS));

/**
 * Builtin slugs (`inbox`, …) resolve from the store; an id passes through. A
 * user-chosen slug needs a server lookup, so it resolves only after the route
 * redirects to the real id and the loader runs again — hydrating under the slug
 * key is a harmless miss.
 */
const resolveRouteAgentId = (routeAgentId?: string): string | undefined => {
  if (!routeAgentId) return undefined;
  if (!builtinAgentSlugs.has(routeAgentId)) return routeAgentId;

  return builtinAgentSelectors.getBuiltinAgentId(routeAgentId)(useAgentStore.getState());
};

/**
 * Seed the sidebar's persisted topic page for a route's agent.
 *
 * Route loaders run before React commits the new route, so this is the one place
 * a local (async) read can still land pre-paint. Without it the sidebar mounts
 * first and paints its loading skeleton until the in-tree hydrate resolves.
 */
export const preHydrateTopicListForRoute = async (routeAgentId?: string): Promise<void> => {
  const agentId = resolveRouteAgentId(routeAgentId);
  if (!agentId) return;

  const params = getSidebarTopicListParams({ agentId });
  if (!params) return;

  await settleWithin(
    useChatStore.getState().preHydrateTopicList(params),
    PRE_PAINT_HYDRATE_TIMEOUT,
  );
};

/** Loader for the agent chat routes (`/agent/:aid`, `/agent/:aid/:topicId`). */
export const agentChatTopicListLoader = async ({ params }: LoaderFunctionArgs): Promise<null> => {
  await preHydrateTopicListForRoute(params.aid);

  return null;
};
