import { ScoreToolView } from './components';
import { useScoreToolController } from './hooks';

export function ScoreTool() {
  const viewModel = useScoreToolController();
  return <ScoreToolView viewModel={viewModel} />;
}
