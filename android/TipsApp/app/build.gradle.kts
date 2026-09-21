plugins {
    alias(libs.plugins.android.application)
}

android {
    namespace = "cz.digiteq.tips"
    compileSdk = 37

    defaultConfig {
        applicationId = "cz.digiteq.tips"
        minSdk = 29
        targetSdk = 37
        versionCode = 1
        versionName = "1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildFeatures {
        viewBinding = true
    }

    // The layout-rule tests read the Figma exports (layer names) as test assets.
    sourceSets["androidTest"].assets.srcDir("../../../design-exports/json")

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.activity)
    implementation(libs.material)
    implementation(libs.androidx.constraintlayout)

    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.core.ktx)
}
