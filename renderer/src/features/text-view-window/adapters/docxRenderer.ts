import { renderAsync } from 'docx-preview';

export async function renderDocxIntoContainer(buffer: ArrayBuffer, container: HTMLElement): Promise<void> {
  container.innerHTML = '';
  await renderAsync(buffer, container, undefined, {
    className: 'docx',
    ignoreWidth: false,
    ignoreHeight: false
  });
}
