package cz.digiteq.tips

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.widget.PopupWindow
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.children
import cz.digiteq.tips.data.TipsRepository
import cz.digiteq.tips.databinding.ActivityCategoryBinding
import cz.digiteq.tips.databinding.PopupCategoryFilterBinding
import cz.digiteq.tips.util.padForSystemBars

class CategoryActivity : AppCompatActivity() {

    private lateinit var binding: ActivityCategoryBinding
    private var filterIndex = 0
    private var selectedTip = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        binding = ActivityCategoryBinding.inflate(layoutInflater)
        setContentView(binding.root)
        binding.root.padForSystemBars()

        binding.categoryBackButton.setOnClickListener { finish() }
        binding.categoryOpenButton.setOnClickListener {
            startActivity(
                Intent(this, TipDetailActivity::class.java)
                    .putExtra(TipDetailActivity.EXTRA_TIP_INDEX, selectedTip)
            )
        }
        setUpTabs()
        setUpFilter()
        setUpList()
    }

    private fun setUpTabs() {
        val tabs = listOf(
            binding.categoryTabAll to binding.categoryTabAllLabel,
            binding.categoryTabAssistants to binding.categoryTabAssistantsLabel,
            binding.categoryTabParking to binding.categoryTabParkingLabel,
            binding.categoryTabWinter to binding.categoryTabWinterLabel,
        )
        // The tabs only show which one is selected; they don't filter the list yet.
        fun selectTab(selectedTab: View) {
            tabs.forEach { (tab, label) ->
                val selected = tab === selectedTab
                tab.isSelected = selected
                label.setTextAppearance(
                    if (selected) R.style.Tips_Text_Tab_Selected else R.style.Tips_Text_Tab
                )
            }
        }
        tabs.forEach { (tab, _) -> tab.setOnClickListener { selectTab(tab) } }
        selectTab(binding.categoryTabAll)
    }

    private fun setUpFilter() {
        binding.categoryFilterButton.setOnClickListener { showFilterDropdown() }
    }

    private fun showFilterDropdown() {
        val dropdown = PopupCategoryFilterBinding.inflate(layoutInflater)
        val options = listOf(
            dropdown.categoryFilterOption1 to dropdown.categoryFilterOption1Radio,
            dropdown.categoryFilterOption2 to dropdown.categoryFilterOption2Radio,
            dropdown.categoryFilterOption3 to dropdown.categoryFilterOption3Radio,
        )
        val labels = listOf(
            dropdown.categoryFilterOption1Label,
            dropdown.categoryFilterOption2Label,
            dropdown.categoryFilterOption3Label,
        )
        val popup = PopupWindow(
            dropdown.root,
            resources.getDimensionPixelSize(R.dimen.dropdown_width),
            ViewGroup.LayoutParams.WRAP_CONTENT,
            true,
        )
        options.forEachIndexed { index, (option, radio) ->
            radio.isSelected = index == filterIndex
            option.setOnClickListener {
                filterIndex = index
                binding.categoryFilterButtonLabel.text = labels[index].text
                popup.dismiss()
            }
        }
        // R6: opens downward, 8 dp below the pill, same left edge.
        popup.showAsDropDown(binding.categoryFilterButton, 0, (8 * resources.displayMetrics.density).toInt())
    }

    private fun setUpList() {
        val rows = binding.categoryTipList.findViewById<ViewGroup>(R.id.category_tip_list_rows)
        rows.children.forEachIndexed { index, row -> row.setOnClickListener { select(index) } }
        binding.categoryTipListScrollbar.attachTo(binding.categoryTipListScroll)
        select(0)
    }

    private fun select(index: Int) {
        selectedTip = index
        val rows = binding.categoryTipList.findViewById<ViewGroup>(R.id.category_tip_list_rows)
        rows.children.forEachIndexed { i, row -> row.isSelected = i == index }

        val tip = TipsRepository.tips[index]
        binding.categoryTipPreviewMeta.text =
            getString(R.string.category_preview_meta, getString(tip.subtitle).uppercase())
        binding.categoryTipPreviewTitle.setText(tip.title)
        binding.categoryTipPreviewBody.setText(tip.body)
    }
}
