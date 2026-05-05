import { routing } from "@/i18n/routing";
import { notFound } from "next/navigation";

const CONTENT: Record<string, {
  title: string;
  effectiveDate: string;
  intro: string;
  sections: Array<{ title: string; body: string }>;
}> = {
  ko: {
    title: "개인정보처리방침",
    effectiveDate: "시행일: 2026-05-06",
    intro:
      "Live Stream Translator(LST)는 서비스 제공을 위해 필요한 범위 내에서 개인정보를 처리하며, 관련 법령을 준수합니다.",
    sections: [
      {
        title: "1. 수집 항목",
        body:
          "계정 식별 정보(이메일, 사용자 ID), 프로필 정보(핸들/닉네임), 서비스 이용 로그, 유튜브 연동 시 필요한 인증 정보가 처리될 수 있습니다.",
      },
      {
        title: "2. 이용 목적",
        body:
          "회원 식별, 서비스 제공 및 개선, 자막 커뮤니티 기능 운영, 부정 사용 방지, 고객 문의 대응을 위해 정보를 이용합니다.",
      },
      {
        title: "3. 보관 및 파기",
        body:
          "법령상 보존 의무가 있는 경우를 제외하고, 목적 달성 후에는 지체 없이 파기합니다. 보관 기간은 서비스 운영 정책에 따릅니다.",
      },
      {
        title: "4. 제3자 제공 및 처리 위탁",
        body:
          "서비스 운영을 위해 필요한 경우에 한해 인프라/인증 제공자에게 처리가 위탁될 수 있습니다. 법령상 요구가 없는 한 임의 제공하지 않습니다.",
      },
      {
        title: "5. 이용자 권리",
        body:
          "이용자는 자신의 개인정보에 대해 열람, 정정, 삭제, 처리 정지를 요청할 수 있습니다.",
      },
    ],
  },
  en: {
    title: "Privacy Policy",
    effectiveDate: "Effective date: 2026-05-06",
    intro:
      "Live Stream Translator (LST) processes personal data only to the extent necessary to provide the Service and in accordance with applicable laws.",
    sections: [
      {
        title: "1. Data We Process",
        body:
          "We may process account identifiers (email, user ID), profile data (handle/display name), service logs, and authentication data required for YouTube connection.",
      },
      {
        title: "2. Purposes of Processing",
        body:
          "Data is used for user authentication, service operation and improvement, subtitle community features, abuse prevention, and support responses.",
      },
      {
        title: "3. Retention and Deletion",
        body:
          "Unless retention is required by law, data is deleted without undue delay after the processing purpose is fulfilled, according to operational policies.",
      },
      {
        title: "4. Sharing and Processors",
        body:
          "When necessary for service operations, processing may be delegated to infrastructure or authentication providers. We do not disclose data arbitrarily.",
      },
      {
        title: "5. Your Rights",
        body:
          "You may request access, correction, deletion, or restriction of processing for your personal data.",
      },
    ],
  },
  ja: {
    title: "プライバシーポリシー",
    effectiveDate: "施行日: 2026-05-06",
    intro:
      "Live Stream Translator（LST）は、サービス提供に必要な範囲で個人情報を取り扱い、関連法令を遵守します。",
    sections: [
      {
        title: "1. 取得・処理する情報",
        body:
          "アカウント識別情報（メールアドレス、ユーザーID）、プロフィール情報（ハンドル/表示名）、利用ログ、YouTube連携に必要な認証情報等を処理する場合があります。",
      },
      {
        title: "2. 利用目的",
        body:
          "本人確認、サービス提供・改善、字幕コミュニティ機能の運用、不正利用防止、お問い合わせ対応のために利用します。",
      },
      {
        title: "3. 保管と削除",
        body:
          "法令による保存義務がある場合を除き、利用目的達成後は遅滞なく削除します。保管期間は運用ポリシーに従います。",
      },
      {
        title: "4. 第三者提供・委託",
        body:
          "サービス運営上必要な範囲で、インフラ/認証事業者へ処理を委託する場合があります。法令に基づく場合を除き、任意提供は行いません。",
      },
      {
        title: "5. 利用者の権利",
        body:
          "利用者は自己の個人情報について、開示・訂正・削除・処理停止を求めることができます。",
      },
    ],
  },
};

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!(routing.locales as readonly string[]).includes(locale)) {
    notFound();
  }

  const content = CONTENT[locale] ?? CONTENT.en;

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 md:p-8">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{content.title}</h1>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{content.effectiveDate}</p>
        <p className="mt-4 text-sm leading-7 text-zinc-700 dark:text-zinc-300">{content.intro}</p>

        <div className="mt-8 space-y-6">
          {content.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {section.title}
              </h2>
              <p className="mt-2 text-sm leading-7 text-zinc-700 dark:text-zinc-300">
                {section.body}
              </p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
