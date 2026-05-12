#!/usr/bin/env node

/**
 * API Examples for Yalova Realty Bot
 * 
 * Примеры использования REST API для управления каталогом квартир
 * 
 * Убедитесь, что бот запущен:
 * npm start
 */

const API_URL = 'http://localhost:5000';

// ============================================
// 1. ПОЛУЧИТЬ ВСЕ КВАРТИРЫ
// ============================================

async function getAllApartments() {
  try {
    const response = await fetch(`${API_URL}/api/apartments`);
    const apartments = await response.json();
    console.log('📋 Все квартиры:');
    console.log(JSON.stringify(apartments, null, 2));
    return apartments;
  } catch (error) {
    console.error('❌ Ошибка при получении квартир:', error.message);
  }
}

// ============================================
// 2. ДОБАВИТЬ НОВУЮ КВАРТИРУ
// ============================================

async function addApartment(apartmentData) {
  try {
    const response = await fetch(`${API_URL}/api/apartments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(apartmentData)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Квартира добавлена:');
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('❌ Ошибка при добавлении квартиры:', error.message);
  }
}

// ============================================
// 3. УДАЛИТЬ КВАРТИРУ
// ============================================

async function deleteApartment(apartmentId) {
  try {
    const response = await fetch(`${API_URL}/api/apartments/${apartmentId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Квартира удалена:', apartmentId);
    return result;
  } catch (error) {
    console.error('❌ Ошибка при удалении квартиры:', error.message);
  }
}

// ============================================
// 4. ПОЛУЧИТЬ СТАТИСТИКУ
// ============================================

async function getStatistics() {
  try {
    const apartments = await getAllApartments();
    
    if (!apartments || apartments.length === 0) {
      console.log('📊 Статистика: Каталог пуст');
      return;
    }

    const stats = {
      total: apartments.length,
      forSale: apartments.filter(a => a.status === 'sale').length,
      forRent: apartments.filter(a => a.status === 'rent').length,
      apartments: apartments.filter(a => a.type === 'apartment').length,
      villas: apartments.filter(a => a.type === 'villa').length,
      land: apartments.filter(a => a.type === 'land').length
    };

    console.log('📊 Статистика каталога:');
    console.log(`   Всего объектов: ${stats.total}`);
    console.log(`   На продажу: ${stats.forSale}`);
    console.log(`   На аренду: ${stats.forRent}`);
    console.log(`   Квартир: ${stats.apartments}`);
    console.log(`   Вилл: ${stats.villas}`);
    console.log(`   Участков: ${stats.land}`);
  } catch (error) {
    console.error('❌ Ошибка при получении статистики:', error.message);
  }
}

// ============================================
// ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ
// ============================================

async function runExamples() {
  console.log('🚀 API Examples for Yalova Realty Bot\n');
  console.log('Убедитесь, что бот запущен: npm start\n');

  // Пример 1: Добавление квартиры
  console.log('--- ПРИМЕР 1: Добавление квартиры ---');
  const newApartment = await addApartment({
    title: 'Квартира с видом на море',
    description: '3-комнатная квартира в новом комплексе Премиум',
    price: '$150,000',
    type: 'apartment',
    status: 'sale',
    rooms: '3',
    area: '95'
  });
  console.log();

  // Пример 2: Добавление виллы
  console.log('--- ПРИМЕР 2: Добавление виллы ---');
  const newVilla = await addApartment({
    title: 'Люкс вилла у пляжа',
    description: 'Красивая вилла с бассейном и видом на море',
    price: '$3,000/месяц',
    type: 'villa',
    status: 'rent',
    rooms: '4',
    area: '250'
  });
  console.log();

  // Пример 3: Добавление земельного участка
  console.log('--- ПРИМЕР 3: Добавление земельного участка ---');
  const newLand = await addApartment({
    title: 'Участок у моря',
    description: '1000 м² земли в центре Яловы',
    price: '$75,000',
    type: 'land',
    status: 'sale',
    area: '1000'
  });
  console.log();

  // Пример 4: Получение всех квартир
  console.log('--- ПРИМЕР 4: Получение всех квартир ---');
  const allApartments = await getAllApartments();
  console.log();

  // Пример 5: Статистика
  console.log('--- ПРИМЕР 5: Статистика каталога ---');
  await getStatistics();
  console.log();

  // Пример 6: Удаление квартиры (если она была добавлена)
  if (newApartment && newApartment.apartment) {
    console.log('--- ПРИМЕР 6: Удаление квартиры ---');
    // Раскомментируйте для удаления:
    // await deleteApartment(newApartment.apartment.id);
    console.log('(Закомментировано для безопасности)');
    console.log();
  }

  console.log('✅ Примеры завершены!');
}

// ============================================
// CURL ПРИМЕРЫ (для терминала)
// ============================================

/*

// 1. Получить все квартиры
curl http://localhost:5000/api/apartments

// 2. Добавить квартиру
curl -X POST http://localhost:5000/api/apartments \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Квартира в центре",
    "description": "2-комнатная квартира",
    "price": "$100,000",
    "type": "apartment",
    "status": "sale",
    "rooms": "2",
    "area": "75"
  }'

// 3. Добавить виллу
curl -X POST http://localhost:5000/api/apartments \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Вилла со статусом",
    "description": "Красивая вилла",
    "price": "$250,000",
    "type": "villa",
    "status": "sale",
    "rooms": "5",
    "area": "350"
  }'

// 4. Удалить квартиру (замените ID на реальный)
curl -X DELETE http://localhost:5000/api/apartments/1704067800123

// 5. Получить и красиво вывести (Python)
curl http://localhost:5000/api/apartments | python -m json.tool

*/

// ============================================
// Запуск примеров
// ============================================

if (process.argv[2] === '--run-examples') {
  runExamples().catch(console.error);
} else {
  console.log('Примеры использования API');
  console.log('========================\n');
  console.log('Использование:');
  console.log('  node examples.js --run-examples\n');
  console.log('Доступные функции:');
  console.log('  getAllApartments()      - Получить все квартиры');
  console.log('  addApartment(data)      - Добавить квартиру');
  console.log('  deleteApartment(id)     - Удалить квартиру');
  console.log('  getStatistics()         - Получить статистику\n');
  console.log('Примеры curl команд смотрите в комментариях файла');
}

// Экспортировать для использования в других файлах
export { getAllApartments, addApartment, deleteApartment, getStatistics };
