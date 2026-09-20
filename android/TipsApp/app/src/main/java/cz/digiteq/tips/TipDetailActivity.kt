package cz.digiteq.tips

import android.os.Bundle
import android.view.View
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import cz.digiteq.tips.data.TipsRepository
import cz.digiteq.tips.databinding.ActivityTipDetailBinding
import cz.digiteq.tips.util.padForSystemBars

class TipDetailActivity : AppCompatActivity() {

    private lateinit var binding: ActivityTipDetailBinding
    private var tipIndex = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        binding = ActivityTipDetailBinding.inflate(layoutInflater)
        setContentView(binding.root)
        binding.root.padForSystemBars()

        tipIndex = savedInstanceState?.getInt(KEY_TIP_INDEX)
            ?: intent.getIntExtra(EXTRA_TIP_INDEX, 0)
        showTip()

        binding.tipBackButton.setOnClickListener { finish() }
        // Previous / Next cycle through the tips.
        binding.tipPrevButton.setOnClickListener { moveTip(-1) }
        binding.tipNextButton.setOnClickListener { moveTip(+1) }

        setUpDistanceSetting()
        // The whole row is the touch target, not just the switch.
        binding.tipHelpfulToggleSwitch.isSelected = true
        binding.tipHelpfulToggle.setOnClickListener {
            binding.tipHelpfulToggleSwitch.isSelected = !binding.tipHelpfulToggleSwitch.isSelected
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putInt(KEY_TIP_INDEX, tipIndex)
    }

    private fun moveTip(step: Int) {
        val count = TipsRepository.tips.size
        tipIndex = (tipIndex + step + count) % count
        showTip()
    }

    // Steps are the same for every tip in this POC; only the title changes.
    private fun showTip() {
        binding.tipTitle.setText(TipsRepository.tips[tipIndex].title)
    }

    private fun setUpDistanceSetting() {
        val options = listOf(
            binding.tipDistanceOptionClose to binding.tipDistanceOptionCloseLabel,
            binding.tipDistanceOptionMedium to binding.tipDistanceOptionMediumLabel,
            binding.tipDistanceOptionFar to binding.tipDistanceOptionFarLabel,
        )
        fun select(selectedOption: View) {
            options.forEach { (option, label) ->
                val selected = option === selectedOption
                option.isSelected = selected
                label.setTextAppearance(
                    if (selected) R.style.Tips_Text_Segment_Selected else R.style.Tips_Text_Segment
                )
            }
        }
        options.forEach { (option, _) -> option.setOnClickListener { select(option) } }
        select(binding.tipDistanceOptionMedium)
    }

    companion object {
        const val EXTRA_TIP_INDEX = "tip_index"
        private const val KEY_TIP_INDEX = "tip_index_state"
    }
}
