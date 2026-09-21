package cz.digiteq.tips.rules

import cz.digiteq.tips.HomeActivity
import cz.digiteq.tips.R

class HomeRulesTest : ScreenRulesTest(
    activityClass = HomeActivity::class.java,
    rootId = R.id.home_root,
    contentId = "home_content",
    wideExport = "S1_Home_1840x960.flat.json",
    portraitExport = "S1_Home_1400x1400.autolayout.json",
    p0 = listOf("home_title", "home_featured_tip"),
)
