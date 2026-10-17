import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Layout } from "./Layout";
import { Skeleton } from "@/components/ui/misc";
import { Toaster } from "@/components/ui/toast";
import { LoginGate } from "@/features/auth/LoginGate";

const Dashboard = lazy(() => import("@/features/dashboard/DashboardPage"));
const PathPage = lazy(() => import("@/features/learning-path/PathPage"));
const ModulePage = lazy(() => import("@/features/catalog/ModulePage"));
const VocabularyPage = lazy(() => import("@/features/vocabulary/VocabularyPage"));
const VocabHome = lazy(() => import("@/features/vocab/VocabHome"));
const VocabToday = lazy(() => import("@/features/vocab/TodayPage"));
const VocabExplorer = lazy(() => import("@/features/vocab/ExplorerPage"));
const VocabWord = lazy(() => import("@/features/vocab/WordPage"));
const VocabNotebook = lazy(() => import("@/features/vocab/NotebookPage"));
const VocabStats = lazy(() => import("@/features/vocab/StatsPage"));
const VocabDialogue = lazy(() => import("@/features/vocab/DialoguePage"));
const VocabSession = lazy(() => import("@/features/vocab/session/SessionPage"));
const LessonPlayer = lazy(() => import("@/features/lesson-player/LessonPlayer"));
const ReviewPage = lazy(() => import("@/features/flashcards/ReviewPage"));
const ProgressPage = lazy(() => import("@/features/progress/ProgressPage"));
const ReferencePage = lazy(() => import("@/features/reference/ReferencePage"));
const LibraryPage = lazy(() => import("@/features/reference/LibraryPage"));
const SearchPage = lazy(() => import("@/features/search/SearchPage"));
const NotFound = lazy(() => import("./NotFound"));
const PracticeStudio = lazy(() => import("@/features/ai-practice/PracticeStudioPage"));
const ExerciseSetPage = lazy(() => import("@/features/ai-practice/ExerciseSetPage"));
const WritingStudio = lazy(() => import("@/features/writing-studio/WritingStudioPage"));
const SpeakingStudio = lazy(() => import("@/features/speaking-studio/SpeakingStudioPage"));
const ListeningStudio = lazy(() => import("@/features/listening-studio/ListeningStudioPage").then((m) => ({ default: m.ListeningStudioPage })));
const ListeningSet = lazy(() => import("@/features/listening-studio/ListeningStudioPage").then((m) => ({ default: m.ListeningSetPage })));
const ReadingStudio = lazy(() => import("@/features/reading-studio/ReadingStudioPage").then((m) => ({ default: m.ReadingStudioPage })));
const ReadingSet = lazy(() => import("@/features/reading-studio/ReadingStudioPage").then((m) => ({ default: m.ReadingSetPage })));
const MistakesPage = lazy(() => import("@/features/mistakes/MistakesPage"));
const PlacementPage = lazy(() => import("@/features/placement/PlacementPage"));
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage"));

function Loading() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40" />
      <Skeleton className="h-40" />
    </div>
  );
}

export default function App() {
  return (
    <LoginGate>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/learn/:unitId" element={<LessonPlayer />} />
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="path" element={<PathPage />} />
            <Route path="grammar" element={<ModulePage kind="grammar" />} />
            <Route path="vocabulary" element={<VocabHome />} />
            <Route path="vocabulary/today" element={<VocabToday />} />
            <Route path="vocabulary/explore" element={<VocabExplorer />} />
            <Route path="vocabulary/word/:id" element={<VocabWord />} />
            <Route path="vocabulary/notebook" element={<VocabNotebook />} />
            <Route path="vocabulary/stats" element={<VocabStats />} />
            <Route path="vocabulary/dialogue" element={<VocabDialogue />} />
            <Route path="vocabulary/session/:id" element={<VocabSession />} />
            <Route path="vocabulary/units" element={<VocabularyPage />} />
            <Route path="pronunciation" element={<ModulePage kind="pronunciation" />} />
            <Route path="listening" element={<ModulePage kind="listening" />} />
            <Route path="speaking" element={<ModulePage kind="speaking" />} />
            <Route path="reading" element={<ModulePage kind="reading" />} />
            <Route path="writing" element={<ModulePage kind="writing" />} />
            <Route path="practice" element={<ModulePage kind="practice" />} />
            <Route path="exams" element={<ModulePage kind="exam" />} />
            <Route path="review" element={<ReviewPage />} />
            <Route path="progress" element={<ProgressPage />} />
            <Route path="reference" element={<ReferencePage />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="ai-practice" element={<PracticeStudio />} />
            <Route path="ai-practice/:setId" element={<ExerciseSetPage />} />
            <Route path="writing-studio" element={<WritingStudio />} />
            <Route path="speaking-studio" element={<SpeakingStudio />} />
            <Route path="listening-studio" element={<ListeningStudio />} />
            <Route path="listening-studio/:setId" element={<ListeningSet />} />
            <Route path="reading-studio" element={<ReadingStudio />} />
            <Route path="reading-studio/:setId" element={<ReadingSet />} />
            <Route path="mistakes" element={<MistakesPage />} />
            <Route path="placement" element={<PlacementPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
      <Toaster />
    </LoginGate>
  );
}
