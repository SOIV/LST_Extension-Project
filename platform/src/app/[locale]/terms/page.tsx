import { routing } from "@/i18n/routing";
import { notFound } from "next/navigation";

const CONTENT: Record<string, {
  title: string;
  effectiveDate: string;
  intro: string;
  sections: Array<{ title: string; body: string }>;
}> = {
  ko: {
    title: "이용약관",
    effectiveDate: "시행일: 2026-05-06",
    intro:
      "본 약관은 LST Project 플랫폼(이하 \"서비스\")의 이용 조건과 당사자 간 권리·의무를 규정합니다.",
    sections: [
      {
        title: "1. 서비스 이용",
        body:
          "사용자는 관련 법령과 본 약관을 준수하여 서비스를 이용해야 하며, 타인의 권리를 침해하거나 서비스 운영을 방해하는 행위를 해서는 안 됩니다.",
      },
      {
        title: "2. 계정 및 연동 정보",
        body:
          "사용자는 계정 정보 및 외부 서비스 연동 정보(OAuth 토큰 포함)의 안전한 사용에 협조해야 하며, 무단 사용이 의심되면 즉시 서비스 운영자에게 알려야 합니다.",
      },
      {
        title: "3. 사용자 콘텐츠",
        body:
          "사용자가 업로드하거나 작성한 자막/텍스트의 권리 및 책임은 사용자에게 있습니다. 사용자는 필요한 권한을 보유한 콘텐츠만 등록해야 합니다.",
      },
      {
        title: "4. 서비스 변경 및 중단",
        body:
          "서비스는 기능 개선, 점검, 정책 변경 또는 불가피한 사유로 일부 또는 전부가 변경되거나 중단될 수 있습니다.",
      },
      {
        title: "5. 책임 제한",
        body:
          "서비스는 베타 운영 중일 수 있으며, 제공 과정에서 발생할 수 있는 데이터 손실·중단 등에 대해 법령이 허용하는 범위 내에서 책임이 제한됩니다.",
      },
    ],
  },
  en: {
    title: "Terms of Service",
    effectiveDate: "Effective date: 2026-05-06",
    intro:
      "These Terms govern your use of the LST Project platform (the \"Service\") and define the rights and obligations of users and the operator.",
    sections: [
      {
        title: "1. Use of the Service",
        body:
          "You must comply with applicable laws and these Terms. You must not interfere with the Service or violate the rights of others.",
      },
      {
        title: "2. Account and Connected Data",
        body:
          "You are responsible for proper use of your account and connected external service data (including OAuth tokens), and should report suspected unauthorized access promptly.",
      },
      {
        title: "3. User Content",
        body:
          "You retain responsibility for subtitles and other content you upload. You must upload only content for which you have sufficient rights.",
      },
      {
        title: "4. Changes and Availability",
        body:
          "The Service may be changed, limited, or suspended due to maintenance, feature updates, policy changes, or other operational needs.",
      },
      {
        title: "5. Limitation of Liability",
        body:
          "The Service may operate in beta. To the extent permitted by law, liability for interruptions, errors, or data loss is limited.",
      },
    ],
  },
  ja: {
    title: "利用規約",
    effectiveDate: "施行日: 2026-05-06",
    intro:
      "本規約は、LST Projectプラットフォーム（以下「本サービス」）の利用条件および当事者の権利・義務を定めるものです。",
    sections: [
      {
        title: "1. サービス利用",
        body:
          "利用者は関連法令および本規約を遵守し、第三者の権利侵害やサービス運営を妨げる行為をしてはなりません。",
      },
      {
        title: "2. アカウントおよび連携情報",
        body:
          "利用者はアカウント情報および外部連携情報（OAuthトークンを含む）の安全な利用に協力し、不正利用の疑いがある場合は速やかに連絡してください。",
      },
      {
        title: "3. ユーザーコンテンツ",
        body:
          "字幕その他の投稿コンテンツに関する権利と責任は利用者に帰属します。必要な権限を有するコンテンツのみ投稿してください。",
      },
      {
        title: "4. 変更・中断",
        body:
          "本サービスは、改善・保守・方針変更その他の事情により、内容の変更または提供の中断が行われる場合があります。",
      },
      {
        title: "5. 免責",
        body:
          "本サービスはベータ運用を含む場合があり、法令上許容される範囲で中断・不具合・データ損失等に関する責任を制限します。",
      },
    ],
  },
};

export default async function TermsPage({
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
