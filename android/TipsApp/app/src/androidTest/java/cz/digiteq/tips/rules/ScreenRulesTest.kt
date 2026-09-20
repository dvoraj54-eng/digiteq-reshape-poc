package cz.digiteq.tips.rules

import android.app.Activity
import android.content.res.Configuration
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * The same acceptance checks (rules §10) for every screen, on whichever display the test runs on:
 * wide emulator -> layout/, portrait emulator -> layout-port/. The screen subclasses only say
 * which activity, which Figma exports and which elements are P0.
 */
abstract class ScreenRulesTest(
    private val activityClass: Class<out Activity>,
    private val rootId: Int,
    private val contentId: String,
    private val wideExport: String,
    private val portraitExport: String,
    private val p0: List<String>,
    private val groupedControls: Set<String> = emptySet(),
) {
    private lateinit var scenario: ActivityScenario<out Activity>

    @Before
    fun launch() {
        scenario = ActivityScenario.launch(activityClass)
        InstrumentationRegistry.getInstrumentation().waitForIdleSync()
        Thread.sleep(600) // let layout listeners (e.g. R7) settle
    }

    @After
    fun close() = scenario.close()

    /** Runs [check] on the UI thread and fails with ALL violations listed. */
    protected fun onScreen(check: (ScreenChecker) -> List<String>) {
        var violations = emptyList<String>()
        scenario.onActivity { violations = check(ScreenChecker(it, rootId)) }
        assertTrue("\n" + violations.joinToString("\n") { " - $it" }, violations.isEmpty())
    }

    protected fun isPortrait(): Boolean {
        var portrait = false
        scenario.onActivity { portrait = it.resources.configuration.orientation == Configuration.ORIENTATION_PORTRAIT }
        return portrait
    }

    // ---- the checks --------------------------------------------------------------------

    @Test
    fun everyFigmaLayerExistsAsViewId() {
        val file = if (isPortrait()) portraitExport else wideExport
        val json = InstrumentationRegistry.getInstrumentation().context.assets.open(file).bufferedReader().readText()
        val names = mutableListOf<String>()
        fun walk(o: JSONObject) {
            val n = o.getString("name")
            if (Regex("^(home|category|tip)_").containsMatchIn(n)) names += n
            o.optJSONArray("children")?.let { for (i in 0 until it.length()) walk(it.getJSONObject(i)) }
        }
        walk(JSONObject(json))
        // The dropdown only exists while it is open (it lives in a PopupWindow).
        onScreen { it.figmaLayersExist(names) { n -> n.startsWith("category_filter_dropdown") || n.startsWith("category_filter_option_") } }
    }

    @Test
    fun p0ElementsAreFullyVisible() = onScreen { it.p0FullyVisible(p0) }

    @Test
    fun touchTargetsAreAtLeast76() = onScreen { it.touchTargetSize() }

    @Test
    fun touchTargetsAreAtLeast16Apart() = onScreen { it.touchTargetGaps(groupedControls) }

    @Test
    fun textIsAtLeast22spAndNotTruncated() = onScreen { it.text() }

    @Test
    fun nothingOverlapsOrSticksOut() = onScreen { it.nothingOverlapsOrSticksOut() }

    @Test
    fun contentStaysInsideTheAppAreaWithMargins() = onScreen { it.insideAppArea() + it.outerMargins(contentId) }
}
