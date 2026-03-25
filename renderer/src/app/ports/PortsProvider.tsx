import { createContext, useContext, type ReactNode } from 'react';
import type { AssessmentPort } from './assessment.port';
import type { ChatPort } from './chat.port';
import type { LlmManagerPort } from './llmManager.port';
import type { LlmSessionPort } from './llmSession.port';
import type { RubricPort } from './rubric.port';
import type { WorkspacePort } from './workspace.port';

export interface AppPorts {
  workspace: WorkspacePort;
  assessment: AssessmentPort;
  chat: ChatPort;
  rubric: RubricPort;
  llmManager: LlmManagerPort;
  llmSession: LlmSessionPort;
}

const PortsContext = createContext<AppPorts | undefined>(undefined);

interface PortsProviderProps {
  ports: AppPorts;
  children: ReactNode;
}

export function PortsProvider({ ports, children }: PortsProviderProps) {
  return <PortsContext.Provider value={ports}>{children}</PortsContext.Provider>;
}

export function usePorts(): AppPorts {
  const context = useContext(PortsContext);
  if (!context) {
    throw new Error('usePorts must be used within PortsProvider');
  }

  return context;
}
