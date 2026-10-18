export const DRUNK_ROLES = [
  'villager',
  'werewolf',
  'seer',
  'aura_seer',
  'bodyguard',
  'witch',
  'hunter',
  'lycan',
  'mayor',
  'pacifist',
  'village_idiot',
  'prince',
  'priest',
  'spellcaster',
  'pi',
  'tough_guy',
  'diseased',
  'wolf_cub',
  'vampire',
]
export const BASIC_GUIDES = {
  apprentice_seer:
    'Nếu Tiên tri chết và không còn Tiên tri sống, từ đêm sau bạn được soi một người mỗi đêm. Chỉ biết Sói/không phải Sói; Người lai Sói và Sói giả dân có thể đánh lừa kết quả.',
  bodyguard:
    'Mỗi đêm bảo vệ một người, được chọn mình; không chọn cùng người hai đêm liên tiếp. Chặn tấn công đêm, không chặn treo cổ, Thợ săn hay vết thương cũ của Lực sĩ.',
  cult_leader:
    'Mỗi đêm thu nạp một người sống vào giáo phái; họ không biết mình được thu nạp. Bạn tự thuộc giáo phái. Cuối ván, nếu mọi người còn sống đều thuộc giáo phái, bạn đồng thắng, kể cả khi đã chết.',
  cupid:
    'Đêm đầu chọn hai người yêu nhau, được chọn mình. Họ biết tên nhau, không biết vai nhau. Một người chết thì người kia chết theo. Nếu khác phe, họ chỉ thắng khi là hai người sống cuối cùng.',
  cursed:
    'Ban đầu thuộc Dân và bị soi ra không phải Sói. Nếu Sói cắn mà không được cứu/bảo vệ, bạn sống sót và trở thành Sói, bắt đầu săn từ đêm tiếp theo. Không chuyển thành Ma cà rồng.',
  diseased:
    'Nếu chết trực tiếp vì Sói cắn, đàn Sói nghỉ săn đêm kế tiếp. Chết vì độc, treo cổ hoặc chết theo người yêu không gây dịch bệnh.',
  doppelganger:
    'Đêm đầu chọn một người khác. Khi họ chết, bạn nhận vai và phe hiện tại cùng phần kỹ năng chưa dùng. Không sao chép tình yêu, vết thương hay bảo hộ của họ; các hiệu ứng đang tác động lên chính bạn vẫn giữ nguyên.',
  drunk:
    'Quản trò chọn trước một lá ẩn còn dư. Hai đêm đầu chưa dùng kỹ năng và bị soi như Dân thường. Đầu đêm ba, nếu sống, bạn nhận vai thật. Cuối ván tính thắng/thua theo phe lá ẩn kể cả nếu chưa kịp tỉnh.',
  ghost:
    'Tự chết khi đêm đầu kết thúc. Từ đêm hai, dù đã chết, được gửi một chữ cái hoặc bỏ qua. Không dùng chữ đầu của bất kỳ từ nào trong tên người chơi. Chữ được công bố khi trời sáng.',
  hunter:
    'Khi chết vì bất kỳ nguyên nhân nào, được chọn bắn một người sống khác hoặc bỏ qua. Phát bắn không bị bảo vệ chặn. Chỉ chốt thắng/thua sau khi xử lý tất cả phát bắn và cái chết liên quan.',
  lone_wolf:
    'Săn cùng đàn nhưng muốn thắng riêng. Thắng khi chỉ còn mình hoặc còn đúng một người không thuộc phe Sói. Không thắng theo phe Sói nếu chưa đạt mục tiêu riêng.',
  old_hag:
    'Mỗi đêm chọn một người khác để ngày sau không được nói, bỏ phiếu hoặc bị đề cử. Người đó vẫn sống và vẫn có thể chết do tác động khác.',
  pi: 'Một lần trong ván chọn một người sống, được chọn mình. Biết nhóm gồm người đó và hai người sống gần nhất bên cạnh có Sói thật hay không, không biết ai là Sói. Không bị Người lai Sói/Sói giả dân đánh lừa.',
  tanner:
    'Mục tiêu riêng là chết trong ván bằng bất kỳ nguyên nhân nào. Cái chết của bạn không kết thúc ván. Cuối ván thắng riêng nếu đã chết; các phe khác vẫn tính kết quả bình thường.',
  tough_guy:
    'Bị Sói cắn mà không được cứu/bảo vệ thì sống qua ngày sau và chết khi đêm tiếp theo kết thúc. Không chữa được vết thương cũ; các nguyên nhân khác vẫn giết theo luật thường.',
  vampire:
    'Các Ma cà rồng cùng chọn một người không cùng phe. Người đó chết sau phiên biểu quyết ban ngày kế tiếp. Bảo vệ/ban phước có thể chặn lúc bị cắn. Miễn nhiễm Sói cắn. Thắng khi mọi người còn sống đều là Ma cà rồng.',
  wolf_cub:
    'Săn cùng đàn. Khi chết, đàn được chọn hai nạn nhân khác nhau ở đêm tiếp theo. Nếu đàn bị Con bệnh tác động thì vẫn nghỉ săn, không dồn lượt cắn.',
  hoodlum:
    'Đêm đầu chọn hai người khác nhau, không chọn mình. Cuối ván thắng riêng nếu bạn sống và cả hai mục tiêu đều chết. Có thể đồng thắng với phe khác.',
  troublemaker:
    'Một lần trong ván kích hoạt vào ban đêm để ngày sau có hai phiên đề cử → giải thích → Có/Không. Nếu Hoàng tử được miễn treo thì ngày vẫn kết thúc ngay.',
  witch:
    'Mỗi bình cứu/độc dùng một lần, được dùng cả hai cùng đêm. Bình cứu hóa giải một vết cắn Sói: chọn rõ nạn nhân khi có hai vết cắn. Không chữa vết cắn Ma cà rồng hoặc vết thương cũ của Lực sĩ.',
  priest:
    'Một lần ban phước cho người khác. Phép tồn tại đến khi chặn một đòn tấn công ban đêm; không chặn treo cổ, Thợ săn, chết theo người yêu hay vết thương cũ của Lực sĩ.',
  prince:
    'Miễn lần treo cổ đầu tiên và công khai vai; ngày đó kết thúc ngay. Những lần treo sau và các nguyên nhân chết khác vẫn có tác dụng.',
  spellcaster:
    'Mỗi đêm chọn một người khác để họ không được nói vào ngày sau, hoặc bỏ qua. Người bị câm vẫn bỏ phiếu được. Không được làm câm cùng một người hai lần trong cả ván; bỏ qua không tiêu hao mục tiêu.',
  mayor:
    'Phiếu của bạn có trọng số hai ở cả vòng đề cử người giải thích và vòng Có/Không treo cổ. Vai vẫn được giữ bí mật. Treo cổ cần số phiếu Có lớn hơn một nửa tổng trọng số phiếu của người được bỏ phiếu.',
  aura_seer:
    'Mỗi đêm soi một người khác, chỉ biết vai thường hay vai đặc biệt. Dân thường, Sói thường và Kẻ say rượu chưa tỉnh hiện là vai thường; các vai khác hiện là vai đặc biệt. Chỉ nhận kết quả sau khi xác nhận.',
  seer: 'Mỗi đêm chọn một người khác và xác nhận để biết Sói/không phải Sói. Người lai Sói bị soi thành Sói; Sói giả dân bị soi thành không phải Sói. Không biết tên vai chính xác.',
  sorceress:
    'Thuộc phe Sói nhưng không đi săn và không được báo danh tính bầy Sói. Mỗi đêm chọn một người khác để biết có phải Tiên tri thường hay không; không nhận diện Tiên tri tập sự hoặc các Tiên tri biến thể. Tiên tri thường soi bạn ra không phải Sói.',
  minion:
    'Đêm đầu xác nhận để biết tên các Sói đang đi săn. Không cùng Sói chọn nạn nhân và Sói không được báo bạn là ai. Tiên tri thường soi ra không phải Sói. Thắng theo phe Sói.',
  mason:
    'Đêm đầu xác nhận để nhận danh sách Hội Tam điểm. Bộ bài phải có đủ hai lá Hội Tam điểm. Không có thao tác riêng ở các đêm sau; thắng cùng Dân làng.',
  pacifist:
    'Vòng đề cử được chọn người hoặc phiếu trắng như thường. Ở vòng Có/Không treo cổ, bạn bắt buộc chọn Không. Vẫn phải xác nhận phiếu.',
  village_idiot:
    'Vòng đề cử được chọn người hoặc phiếu trắng như thường. Ở vòng Có/Không treo cổ, bạn bắt buộc chọn Có, kể cả khi chính bạn đang bị xét xử. Vẫn phải xác nhận phiếu.',
  lycan:
    'Bạn thuộc Dân làng và không đi săn, nhưng Tiên tri thường/Tiên tri tập sự soi ra Sói. P.I. kiểm tra Sói thật nên không bị bạn đánh lừa.',
  wolf_man:
    'Bạn là Sói thật và cùng đàn thống nhất nạn nhân. Tiên tri thường/Tiên tri tập sự soi ra không phải Sói; P.I. vẫn phát hiện có Sói, Tiên tri bí ẩn biết đúng tên vai.',
  mentalist:
    'Mỗi đêm chọn hai người khác nhau, không chọn mình, rồi xác nhận để biết cùng phe hay khác phe. Không biết tên vai. Các vai thắng riêng được xem là những phe cá nhân riêng biệt; Kẻ say rượu tính theo phe lá ẩn.',
  mystic_seer:
    'Mỗi đêm chọn một người khác và xác nhận để biết chính xác vai hiện tại. Kẻ say rượu chưa tỉnh vẫn hiện là Kẻ say rượu; không lộ lá ẩn của họ.',
  huntress:
    'Một lần trong ván, chọn một người khác vào ban đêm để bắn hoặc xác nhận bỏ qua để giữ phát bắn. Bảo vệ và ban phước có thể chặn phát bắn ban đêm này; khác với phát bắn cuối của Thợ săn khi chết.',
  werewolf:
    'Mỗi đêm cùng các Sói thống nhất mục tiêu và từng người xác nhận. Không cắn Sói khác, ngoại trừ được hy sinh Sói con. Phe Sói thắng khi đạt ít nhất nửa số người sống, còn Sói thường/Sói con/Sói giả dân và không còn Ma cà rồng; Sói đơn độc có mục tiêu thắng riêng.',
  villager:
    'Không có thao tác ban đêm. Ban ngày thảo luận, đề cử người giải thích và biểu quyết Có/Không treo cổ. Thắng cùng Dân khi không còn Sói thật, Ma cà rồng hoặc Sói chưa tỉnh trong lá ẩn của Kẻ say rượu.',
}
