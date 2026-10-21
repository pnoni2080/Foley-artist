/* ============================================================
   Firebase 설정 (선생님이 한 번만 채워 넣는 파일)

   1. Firebase 콘솔 → 프로젝트 설정 → 내 앱 → 웹 앱(</>) 추가
   2. "firebaseConfig" 안의 값을 아래에 그대로 붙여 넣기
   3. 저장 후 푸시(배포)하면 '선생님께 보내기'와 발표 화면이 켜져요

   비워 두면(null) 보내기 기능은 숨겨지고, 나머지 기능은 그대로 동작해요.
   ============================================================ */
window.FOLEY_FIREBASE_CONFIG = null;

/* 예시:
window.FOLEY_FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "my-project.firebaseapp.com",
  projectId: "my-project",
  storageBucket: "my-project.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef",
};
*/

// 로컬 에뮬레이터로 시험할 때만 true (평소에는 false)
window.FOLEY_USE_EMULATOR = false;
