$ErrorActionPreference = 'Stop'
$outDir = Join-Path $PSScriptRoot 'output'
$previewDir = Join-Path $PSScriptRoot '.ppt-preview'
New-Item -ItemType Directory -Force -Path $outDir, $previewDir | Out-Null
$app = New-Object -ComObject PowerPoint.Application
$deck = $app.Presentations.Add(0)
$deck.PageSetup.SlideWidth = 960
$deck.PageSetup.SlideHeight = 540
function Color($r, $g, $b) { return $r + 256 * $g + 65536 * $b }
$ink = Color 24 39 60
$blue = Color 31 93 168
$gray = Color 81 94 110
function Text($slide, $text, $x, $y, $w, $h, $size, $color, $bold = $false, $font = '맑은 고딕') {
    $shape = $slide.Shapes.AddTextbox(1, $x, $y, $w, $h)
    $shape.TextFrame.MarginLeft = 0
    $shape.TextFrame.MarginRight = 0
    $shape.TextFrame.MarginTop = 0
    $shape.TextFrame.MarginBottom = 0
    $shape.TextFrame.WordWrap = -1
    $shape.TextFrame.TextRange.Text = $text
    $shape.TextFrame.TextRange.Font.Name = $font
    $shape.TextFrame.TextRange.Font.NameFarEast = '맑은 고딕'
    $shape.TextFrame.TextRange.Font.Size = $size
    $shape.TextFrame.TextRange.Font.Color.RGB = $color
    if ($bold) { $shape.TextFrame.TextRange.Font.Bold = -1 }
    return $shape
}
function Slide($title) {
    $s = $deck.Slides.Add($deck.Slides.Count + 1, 12)
    $s.FollowMasterBackground = 0
    $s.Background.Fill.ForeColor.RGB = Color 250 251 253
    $null = Text $s $title 56 42 850 64 32 $ink $true
    $null = Text $s ([string]$s.SlideIndex) 860 498 44 20 11 $gray
    return $s
}
try {
    $s = Slide '정렬 코드와 시각화'
    $null = Text $s '학생용 구현 가이드' 56 155 840 65 42 $blue $true
    $null = Text $s "알고리즘은 직접 구현하고,`nsteps로 비교와 배열 변경을 기록합니다." 56 260 840 100 26 $ink
    $null = Text $s 'Insertion / Merge / Quick / Heap Sort' 56 420 840 34 21 $gray

    $s = Slide '제출 형식과 정렬 기준'
    $code = @'
module.exports = {
    sort(items, steps) {
        const result = items.map(item => ({ ...item }));
        // 정렬 알고리즘 구현
        return result;
    }
};
'@
    $null = Text $s $code 56 134 850 230 19 $blue $false 'Consolas'
    $null = Text $s "객체의 priority를 기준으로 내림차순 정렬`n객체 전체를 이동하고, 정렬된 배열을 반환" 56 385 850 80 23 $ink

    $s = Slide '시각화에 사용하는 네 함수'
    $rows = @(
        @('함수', '역할', '배열 변경'),
        @('compare(result, i, j)', '두 위치의 비교 표시', '없음'),
        @('swap(result, i, j)', '두 항목 교환', '있음'),
        @('write(result, i, value)', '한 위치에 객체 대입', '있음'),
        @('fixed(result, i)', '최종 위치 확정 표시', '없음')
    )
    $table = $s.Shapes.AddTable(5, 3, 56, 135, 848, 255).Table
    $table.Columns.Item(1).Width = 390
    $table.Columns.Item(2).Width = 300
    $table.Columns.Item(3).Width = 158
    for ($r = 1; $r -le 5; $r++) {
        for ($c = 1; $c -le 3; $c++) {
            $cell = $table.Cell($r, $c).Shape
            $cell.TextFrame.TextRange.Text = $rows[$r-1][$c-1]
            $cell.TextFrame.TextRange.Font.Name = '맑은 고딕'
            $cell.TextFrame.TextRange.Font.Size = 18
            $cell.TextFrame.TextRange.Font.Color.RGB = $ink
            $cell.Fill.ForeColor.RGB = Color 240 244 249
            if ($r -eq 1) {
                $cell.Fill.ForeColor.RGB = $blue
                $cell.TextFrame.TextRange.Font.Color.RGB = Color 255 255 255
                $cell.TextFrame.TextRange.Font.Bold = -1
            }
        }
    }
    $null = Text $s '모두 steps.함수명(...)으로 호출합니다. i와 j는 배열 인덱스입니다.' 56 423 848 58 20 $gray

    $s = Slide 'compare와 fixed'
    $null = Text $s 'compare는 비교 장면을 기록합니다' 56 132 848 40 25 $blue $true
    $null = Text $s "steps.compare(result, i, j);`nif (result[i].priority < result[j].priority) { ... }" 56 190 848 90 21 $ink $false 'Consolas'
    $null = Text $s '실제 대소 비교는 if 문으로 직접 작성합니다.' 56 288 848 42 21 $gray
    $null = Text $s 'fixed는 더 이상 이동하지 않는 위치에 사용합니다' 56 365 848 44 25 $blue $true
    $null = Text $s '삽입 정렬의 정렬된 앞부분은 이후에도 바뀔 수 있습니다.' 56 426 848 42 21 $ink

    $s = Slide 'swap과 write의 차이'
    $null = Text $s '두 항목의 자리 교환: swap' 56 130 848 42 25 $blue $true
    $null = Text $s "// [A, B]를 [B, A]로 변경`nsteps.swap(result, 0, 1);" 56 185 848 80 23 $ink $false 'Consolas'
    $null = Text $s '한 위치에 객체 대입: write' 56 296 848 42 25 $blue $true
    $null = Text $s "// result[index] = merged[i]를 수행`nsteps.write(result, index, merged[i]);" 56 351 848 80 23 $ink $false 'Consolas'
    $null = Text $s '두 함수가 배열을 직접 변경합니다. 같은 변경을 따로 반복하지 마세요.' 56 456 848 40 19 $gray

    $s = Slide '정렬별 사용 예시'
    $null = Text $s "Insertion Sort`n인접 교환은 swap, 밀어쓰기는 write" 56 135 848 70 23 $ink
    $null = Text $s "Merge Sort`n임시 배열에서 병합한 결과를 write로 기록" 56 225 848 70 23 $ink
    $null = Text $s "Quick Sort / Heap Sort`n비교는 compare, 항목 교환은 swap" 56 315 848 70 23 $ink
    $null = Text $s '함수는 알고리즘 이름이 아니라 실제 수행하는 연산에 맞춰 선택합니다.' 56 435 848 50 20 $blue $true

    $s = Slide '업로드와 결과 확인'
    $null = Text $s "1. .js 파일을 Choose Sort file에서 업로드`n2. All Start 또는 Step으로 과정 확인`n3. priority 내림차순과 항목 보존 여부 확인" 56 134 848 155 25 $ink
    $null = Text $s '현재 화면의 범위' 56 320 848 38 24 $blue $true
    $null = Text $s "steps 호출이 없으면 중간 과정을 표시하지 않습니다.`nwrite 중 같은 id가 겹치면 화면이 부정확할 수 있습니다.`n업로드 성공은 정렬 정답 판정을 의미하지 않습니다." 56 374 848 105 20 $gray

    $deck.SaveAs((Join-Path $outDir 'student-sort-guide.pptx'), 24)
    foreach ($slide in $deck.Slides) {
        $slide.Export((Join-Path $previewDir ('slide-' + $slide.SlideIndex + '.png')), 'PNG', 1280, 720)
        foreach ($shape in $slide.Shapes) {
            if ($shape.HasTextFrame -eq -1 -and $shape.TextFrame.HasText -eq -1) {
                if ($shape.TextFrame.TextRange.BoundHeight -gt $shape.Height + 4) { throw "Text overflow on slide $($slide.SlideIndex)" }
            }
        }
    }
    Write-Output 'Created 7 slides and rendered previews.'
} finally {
    $deck.Close()
    $app.Quit()
}
