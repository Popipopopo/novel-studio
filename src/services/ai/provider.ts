/**
 * AI revision provider interface. Phase 1 ships a manual (clipboard-based)
 * workflow — no API keys are embedded in the frontend. A future deployment
 * can implement this interface against a secure backend gateway (never
 * directly against a provider from the browser, which would expose keys).
 */

export interface RevisionRequest {
  novelTitle: string;
  chapterTitle: string;
  selectedText: string;
  comment?: string;
  chapterSummary?: string;
  narrativeGoal?: string;
}

export interface RevisionResponse {
  proposedText: string;
  rationale?: string;
}

export interface AIRevisionProvider {
  id: string;
  label: string;
  available: boolean;
  proposeRevision(req: RevisionRequest): Promise<RevisionResponse>;
}

/** The manual "copy prompt & paste response" provider used in Phase 1. */
export const manualProvider: AIRevisionProvider = {
  id: 'manual',
  label: '手动（复制 Prompt → 粘贴 AI 回复）',
  available: true,
  async proposeRevision() {
    throw new Error(
      'Manual provider cannot propose directly — use the Propose Revision dialog.'
    );
  },
};

/**
 * Future: a gateway-backed provider. Not wired in the UI yet; the backend
 * design belongs in a server-side component and is intentionally left to
 * be configured per-deployment.
 */
export function createGatewayProvider(endpoint: string): AIRevisionProvider {
  return {
    id: 'gateway',
    label: `远程网关（${endpoint}）`,
    available: false, // not wired yet; set true after backend is deployed
    async proposeRevision(req) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      if (!res.ok) throw new Error('AI 网关请求失败：' + res.status);
      return (await res.json()) as RevisionResponse;
    },
  };
}
