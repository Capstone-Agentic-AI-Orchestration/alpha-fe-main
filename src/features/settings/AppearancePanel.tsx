import { AppearanceView } from '@/shared/theme/view/AppearanceView';
import { useAppearanceViewModel } from '@/shared/theme/viewmodel/useAppearanceViewModel';

export function AppearancePanel() { return <AppearanceView {...useAppearanceViewModel()} />; }
