package cz.digiteq.tips.rules

import android.app.Activity
import android.graphics.Rect
import android.view.View
import android.view.ViewGroup
import android.widget.ScrollView
import android.widget.TextView
import kotlin.math.max

/**
 * The automatable acceptance checks of rules/DESIGN-RULES.md §10, run on the real view tree
 * of a running screen. Every check returns a list of violations (empty = passed), so a test
 * can report all problems of a screen at once instead of stopping at the first.
 * Sizes are in dp (the emulators run at 160 dpi, so 1 dp = 1 Figma px).
 */
class ScreenChecker(private val activity: Activity, rootId: Int) {

    private val density = activity.resources.displayMetrics.density
    private val fontScale = activity.resources.configuration.fontScale
    val root: ViewGroup = activity.findViewById(rootId)

    /** App area: the root view minus the system bars it pads for. Window coordinates, px. */
    val area: Rect = window(root).let {
        Rect(it.left + root.paddingLeft, it.top + root.paddingTop, it.right - root.paddingRight, it.bottom - root.paddingBottom)
    }

    // ---- helpers -------------------------------------------------------------------------

    fun dp(px: Int): Float = px / density
    fun window(v: View): Rect {
        val loc = IntArray(2)
        v.getLocationInWindow(loc)
        return Rect(loc[0], loc[1], loc[0] + v.width, loc[1] + v.height)
    }

    fun name(v: View): String =
        if (v.id == View.NO_ID) "${v.javaClass.simpleName}(no id)"
        else runCatching { activity.resources.getResourceEntryName(v.id) }.getOrDefault("id#${v.id}")

    fun view(idName: String): View? {
        val id = activity.resources.getIdentifier(idName, "id", activity.packageName)
        return if (id == 0) null else root.findViewById(id)
    }

    fun all(from: View = root): Sequence<View> = sequence {
        yield(from)
        if (from is ViewGroup) for (i in 0 until from.childCount) yieldAll(all(from.getChildAt(i)))
    }

    private fun shown(v: View) = v.isShown && v.width > 0 && v.height > 0

    // ---- §10.2 / §9 traceability ----------------------------------------------------------

    /** Every Figma layer name (with a screen prefix) must exist as a view id in the running screen. */
    fun figmaLayersExist(layerNames: List<String>, exempt: (String) -> Boolean): List<String> =
        layerNames.filterNot(exempt).mapNotNull { if (view(it) == null) "Figma layer '$it' has no view with that id" else null }

    // ---- §10.1 P0 visible -----------------------------------------------------------------

    fun p0FullyVisible(ids: List<String>): List<String> = ids.mapNotNull { id ->
        val v = view(id) ?: return@mapNotNull "P0 element '$id' does not exist"
        if (!shown(v)) return@mapNotNull "P0 element '$id' is not visible"
        val visible = Rect()
        val clipped = !v.getLocalVisibleRect(visible) || visible.width() < v.width || visible.height() < v.height
        val w = window(v)
        when {
            clipped -> "P0 element '$id' is clipped (${visible.width()}x${visible.height()} of ${v.width}x${v.height} visible)"
            !area.contains(w) -> "P0 element '$id' ${w.toShortString()} sticks out of the app area ${area.toShortString()}"
            else -> null
        }
    }

    // ---- §10.3 / §10.4 touch targets ------------------------------------------------------

    private fun touchTargets() = all().filter { it.isClickable && shown(it) && it !== root }.toList()

    fun touchTargetSize(minDp: Int = 76): List<String> = touchTargets().mapNotNull {
        if (dp(it.width) < minDp - 0.5f || dp(it.height) < minDp - 0.5f)
            "touch target '${name(it)}' is ${dp(it.width).toInt()}x${dp(it.height).toInt()} dp, minimum $minDp x $minDp" else null
    }

    /** No two touch targets overlap and none are closer than [minGapDp]; segments of a grouped control are exempt. */
    fun touchTargetGaps(groupIds: Set<String>, minGapDp: Int = 16): List<String> {
        val targets = touchTargets()
        val out = mutableListOf<String>()
        for (i in targets.indices) for (j in i + 1 until targets.size) {
            val a = targets[i]; val b = targets[j]
            if (isAncestor(a, b) || isAncestor(b, a)) continue
            if (groupIds.any { g -> sameGroup(a, b, g) }) continue
            val ra = window(a); val rb = window(b)
            val dx = max(0, max(ra.left, rb.left) - minOf(ra.right, rb.right))
            val dy = max(0, max(ra.top, rb.top) - minOf(ra.bottom, rb.bottom))
            val gap = dp(max(dx, dy))
            if (gap < minGapDp - 0.5f) out += "touch targets '${name(a)}' and '${name(b)}' are ${gap.toInt()} dp apart, minimum $minGapDp"
        }
        return out
    }

    private fun isAncestor(a: View, b: View): Boolean {
        var p = b.parent
        while (p is View) { if (p === a) return true; p = p.parent }
        return false
    }

    private fun sameGroup(a: View, b: View, groupId: String): Boolean {
        val g = view(groupId) ?: return false
        return isAncestor(g, a) && isAncestor(g, b)
    }

    // ---- §10.6 / §10.9 text ---------------------------------------------------------------

    fun text(minSp: Int = 22): List<String> = all().filterIsInstance<TextView>().filter { shown(it) }.toList().flatMap { t ->
        val out = mutableListOf<String>()
        val sp = t.textSize / (density * fontScale)
        if (sp < minSp - 0.1f) out += "text '${name(t)}' is ${"%.1f".format(sp)} sp, minimum $minSp"
        t.layout?.let { l ->
            if (l.lineCount > 0 && (l.getEllipsisCount(l.lineCount - 1) > 0 || l.getLineEnd(l.lineCount - 1) < t.text.length))
                out += "text '${name(t)}' is truncated"
            if (l.height + t.compoundPaddingTop + t.compoundPaddingBottom > t.height + 1)
                out += "text '${name(t)}' needs ${l.height} px but its view has ${t.height - t.compoundPaddingTop - t.compoundPaddingBottom} (clipped)"
        }
        out
    }

    // ---- §10.9 / §10.5 / §10.8 geometry ---------------------------------------------------

    /** Siblings don't overlap and children stay inside their parent (scroll content and FrameLayout stacks excluded by design). */
    fun nothingOverlapsOrSticksOut(): List<String> {
        val out = mutableListOf<String>()
        for (g in all().filterIsInstance<ViewGroup>()) {
            if (g is ScrollView) continue
            val kids = (0 until g.childCount).map { g.getChildAt(it) }.filter { it.visibility == View.VISIBLE && it.width > 0 && it.height > 0 }
            for (k in kids) {
                if (k.left < -1 || k.top < -1 || k.right > g.width + 1 || k.bottom > g.height + 1)
                    out += "'${name(k)}' sticks out of its parent '${name(g)}'"
            }
            if (g is android.widget.FrameLayout) continue
            for (i in kids.indices) for (j in i + 1 until kids.size) {
                val a = kids[i]; val b = kids[j]
                val overlapX = minOf(a.right, b.right) - max(a.left, b.left)
                val overlapY = minOf(a.bottom, b.bottom) - max(a.top, b.top)
                if (overlapX > 1 && overlapY > 1) out += "'${name(a)}' and '${name(b)}' overlap inside '${name(g)}'"
            }
        }
        return out
    }

    /** Header and content area stay inside the app area (nothing under the system bars). */
    fun insideAppArea(): List<String> = (0 until root.childCount).map { root.getChildAt(it) }.filter { shown(it) }.mapNotNull {
        val w = window(it); if (area.contains(w)) null else "'${name(it)}' ${w.toShortString()} is outside the app area ${area.toShortString()}"
    }

    /** Outer margin: the panes of the content container keep [marginDp] to the app area edges. */
    fun outerMargins(contentId: String, marginDp: Int = 24): List<String> {
        val c = view(contentId) as? ViewGroup ?: return listOf("content container '$contentId' does not exist")
        val out = mutableListOf<String>()
        for (i in 0 until c.childCount) {
            val k = c.getChildAt(i); if (!shown(k)) continue
            val w = window(k)
            val m = listOf(dp(w.left - area.left), dp(w.top - area.top), dp(area.right - w.right), dp(area.bottom - w.bottom))
            if (m.any { it < marginDp - 0.5f }) out += "'${name(k)}' is closer than $marginDp dp to the app area edge (margins l/t/r/b: ${m.map { it.toInt() }})"
        }
        return out
    }
}
