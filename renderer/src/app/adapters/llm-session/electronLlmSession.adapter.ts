import type { LlmSessionPort } from '@/app/ports';

function getElectronLlmSessionApi(): LlmSessionPort {
  const appWindow = window as Window & { api?: { llmSession?: LlmSessionPort } };
  if (!appWindow.api?.llmSession) {
    throw new Error('window.api.llmSession is not available.');
  }

  return appWindow.api.llmSession;
}

export function createElectronLlmSessionAdapter(): LlmSessionPort {
  return {
    create: (request) => getElectronLlmSessionApi().create(request),
    clear: (request) => getElectronLlmSessionApi().clear(request),
    delete: (request) => getElectronLlmSessionApi().delete(request),
    getTurns: (request) => getElectronLlmSessionApi().getTurns(request),
    listByFile: (request) => getElectronLlmSessionApi().listByFile(request)
  };
}
