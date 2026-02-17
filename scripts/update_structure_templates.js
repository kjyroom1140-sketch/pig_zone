const { sequelize } = require('../config/database');
const StructureTemplate = require('../models/StructureTemplate');

async function main() {
  try {
    await sequelize.authenticate();
    console.log('DB connected');

    // 컬럼 추가 (없는 경우만)
    await sequelize.query('ALTER TABLE "structure_templates" ADD COLUMN IF NOT EXISTS "weight" VARCHAR(50);');

    // 기존 데이터 비우기
    await StructureTemplate.destroy({ where: {}, truncate: true, restartIdentity: true });

    // 새 데이터 입력
    await StructureTemplate.bulkCreate([
      { category: 'production', name: '자돈사(포유자돈)', weight: '1~7kg', optimalDensity: 0.18, description: '분만사 내 / 권장 면적 0.15 ~ 0.20 ㎡/두' },
      { category: 'production', name: '자돈사',           weight: '7~20kg',  optimalDensity: 0.33, description: '보온 중요 / 권장 면적 0.30 ~ 0.35 ㎡/두 (이유자돈)' },
      { category: 'production', name: '육성돈사',          weight: '20~50kg', optimalDensity: 0.63, description: '성장기 / 권장 면적 0.55 ~ 0.70 ㎡/두' },
      { category: 'production', name: '비육돈사',          weight: '50~110kg', optimalDensity: 0.90, description: '권장 면적 0.80 ~ 1.00 ㎡/두' },
      { category: 'production', name: '비육돈사(대형)',    weight: '110kg↑',  optimalDensity: 1.10, description: '출하 전 / 권장 면적 1.00 ~ 1.20 ㎡/두' },
      { category: 'production', name: '후보돈사',          weight: '90~130kg', optimalDensity: 1.90, description: '군사 / 권장 면적 1.8 ~ 2.0 ㎡/두' },
      { category: 'production', name: '교배사',            weight: '성돈',     optimalDensity: 2.35, description: '교배용 스톨 / 권장 면적 2.2 ~ 2.5 ㎡/두' },
      { category: 'production', name: '임신돈사',          weight: '성돈',     optimalDensity: 2.25, description: '군사/스톨 / 권장 면적 2.0 ~ 2.5 ㎡/두' },
      { category: 'production', name: '분만사(모돈)',      weight: '성돈',     optimalDensity: 6.25, description: '분만틀 포함 / 권장 면적 6.0 ~ 6.5 ㎡/두' },
      { category: 'production', name: '웅돈사',            weight: '성돈',     optimalDensity: 6.50, description: '단독 / 권장 면적 6.0 ~ 7.0 ㎡/두' },
    ]);

    console.log('structure_templates schema & data updated');
  } catch (e) {
    console.error('Error updating structure_templates:', e);
  } finally {
    await sequelize.close();
  }
}

main();

