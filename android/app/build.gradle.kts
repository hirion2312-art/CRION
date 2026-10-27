// CRION 안드로이드 껍데기
//  화면 엔진(src/renderer)과 작품 목록(config/)은 빌드할 때 저장소에서 그대로 복사해 앱에 넣는다 (컴퓨터판과 같은 파일)
//  설치 후에는 컴퓨터판처럼 업데이트 서버에서 새 화면 엔진을 받는다
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val repoRoot = rootProject.projectDir.parentFile
val genAssets = layout.buildDirectory.dir("gen-assets")
val copyEngine by tasks.registering(Copy::class) {
    from(File(repoRoot, "src/renderer")) { into("engine") }
    from(File(repoRoot, "config")) { include("works.json", "app.json"); into("config") }
    into(genAssets)
}

// 서명: GitHub 비밀값(ANDROID_KEYSTORE_B64 …)이 있으면 그걸로, 없으면 디버그 열쇠(시험판)
val ksFile = System.getenv("CRION_KEYSTORE_FILE")

android {
    namespace = "com.hirion.crion"
    compileSdk = 34
    defaultConfig {
        applicationId = "com.hirion.crion"
        minSdk = 26
        targetSdk = 34
        versionCode = (System.getenv("CRION_VERSION_CODE") ?: "1").toInt()
        versionName = "0.4.1"
    }
    signingConfigs {
        if (ksFile != null && File(ksFile).exists()) {
            create("release") {
                storeFile = File(ksFile)
                storePassword = System.getenv("CRION_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("CRION_KEY_ALIAS")
                keyPassword = System.getenv("CRION_KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = if (ksFile != null && File(ksFile).exists()) signingConfigs.getByName("release") else signingConfigs.getByName("debug")
        }
    }
    sourceSets["main"].assets.srcDir(genAssets)
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    lint { checkReleaseBuilds = false; abortOnError = false }
}

tasks.named("preBuild") { dependsOn(copyEngine) }

dependencies {
    implementation("androidx.webkit:webkit:1.11.0")
}
