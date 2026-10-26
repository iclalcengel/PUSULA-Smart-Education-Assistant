import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, KeyRound, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const JoinCourse = () => {
  const [courseCode, setCourseCode] = useState("");
  const [joining, setJoining] = useState(false);
  const navigate = useNavigate();

  const joinCourse = async () => {
    const normalizedCode = courseCode.trim().toUpperCase();
    if (!normalizedCode) return toast.error("Lütfen bir kurs kodu gir.");

    setJoining(true);
    const { data, error } = await supabase.rpc("join_course_by_code", { input_code: normalizedCode });
    setJoining(false);

    if (error) {
      if (error.message.includes("ALREADY_ENROLLED")) return toast.error("Bu kursa zaten katıldın.");
      if (error.message.includes("COURSE_NOT_FOUND")) return toast.error("Bu kurs bulunamadı.");
      if (error.message.includes("INVALID_COURSE_CODE")) return toast.error("Geçersiz kurs kodu.");
      return toast.error("Kursa katılırken bir hata oluştu.");
    }

    const joinedCourse = Array.isArray(data) ? data[0] : data;
    toast.success(`${joinedCourse.title} kursuna katıldın!`);
    navigate(`/student/courses/${joinedCourse.id}`);
  };

  return (
    <AppLayout>
      <Link to="/student" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Geri
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-3xl border-0 bg-gradient-to-br from-cyan-500 via-blue-500 to-violet-500 p-8 text-white shadow-pop">
          <KeyRound className="mb-4 h-10 w-10" />
          <h1 className="mb-3 font-display text-4xl font-black">Kursa kod ile katıl</h1>
          <p className="max-w-xl text-sm text-white/90">
            Öğretmeninin paylaştığı kurs kodunu gir. Kod doğruysa kurs anında hesabına eklenir.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-sm font-semibold backdrop-blur">
            <Sparkles className="h-4 w-4" /> Örnek: MAT101-A7K9
          </div>
        </Card>

        <Card className="rounded-3xl border-0 p-6 shadow-card">
          <div className="mb-5">
            <h2 className="font-display text-2xl font-black">Kurs kodu</h2>
            <p className="text-sm text-muted-foreground">Kodu büyük-küçük harf fark etmeksizin yazabilirsin.</p>
          </div>
          <div className="space-y-4">
            <div>
              <Label htmlFor="course-code">Kod</Label>
              <Input
                id="course-code"
                value={courseCode}
                onChange={(event) => setCourseCode(event.target.value.toUpperCase())}
                placeholder="MAT101-A7K9"
                className="mt-1 h-12 rounded-2xl text-base font-semibold tracking-[0.08em]"
              />
            </div>
            <Button onClick={joinCourse} disabled={joining} className="h-12 w-full rounded-2xl border-0 bg-gradient-hero text-base font-bold text-primary-foreground">
              {joining ? "Katılıyor..." : "Kursa katıl"}
            </Button>
            <div className="rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
              Hatalı bir kod girersen sistem sana anlaşılır bir mesaj gösterir.
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
};

export default JoinCourse;
