import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Layout } from "./Layout";
import { Skeleton } from "@/components/ui/misc";
import { Toaster } from "@/components/ui/toast";

const Dashboard = lazy(() => import("@/features/dashboard/DashboardPage"));
const PathPage = lazy(() => import("@/features/learning-path/PathPage"));
const ModulePage = lazy(() => import("@/features/catalog/ModulePage"));
const VocabularyPage = lazy(() => import("@/features/vocabulary/VocabularyPage"));
const LessonPlayer = lazy(() => import("@/features/lesson-player/LessonPlayer"));
const ReviewPage = lazy(() => import("@/features/flashcards/ReviewPage"));
const ProgressPage = lazy(() => import("@/features/progress/ProgressPage"));
const ReferencePage = lazy(() => import("@/features/reference/ReferencePage"));
const LibraryPage = lazy(() => import("@/features/reference/LibraryPage"));
const SearchPage = lazy(() => import("@/features/search/SearchPage"));
const NotFound = lazy(() => import("./NotFound"));

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
    <>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/learn/:unitId" element={<LessonPlayer />} />
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="path" element={<PathPage />} />
            <Route path="grammar" element={<ModulePage kind="grammar" />} />
            <Route path="vocabulary" element={<VocabularyPage />} />
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
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
      <Toaster />
    </>
  );
}
