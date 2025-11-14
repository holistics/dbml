<template>
  <span
    class="inline-flex items-center justify-center w-4 h-4 flex-shrink-0"
    :class="iconClass"
  >
    <!-- Database Icon - Professional multi-layer database cylinder -->
    <svg
      v-if="type === 'database'"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class="w-4 h-4"
    >
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M3.25 6C3.25 4.45831 4.48029 3.26447 6.00774 2.50075C7.58004 1.7146 9.69967 1.25 12 1.25C14.3003 1.25 16.42 1.7146 17.9923 2.50075C19.5197 3.26447 20.75 4.45831 20.75 6V18C20.75 19.5417 19.5197 20.7355 17.9923 21.4992C16.42 22.2854 14.3003 22.75 12 22.75C9.69967 22.75 7.58004 22.2854 6.00774 21.4992C4.48029 20.7355 3.25 19.5417 3.25 18V6ZM4.75 6C4.75 5.33255 5.31057 4.52639 6.67856 3.84239C8.00168 3.18083 9.88205 2.75 12 2.75C14.118 2.75 15.9983 3.18083 17.3214 3.84239C18.6894 4.52639 19.25 5.33255 19.25 6C19.25 6.66745 18.6894 7.47361 17.3214 8.15761C15.9983 8.81917 14.118 9.25 12 9.25C9.88205 9.25 8.00168 8.81917 6.67856 8.15761C5.31057 7.47361 4.75 6.66745 4.75 6ZM4.75 18C4.75 18.6674 5.31057 19.4736 6.67856 20.1576C8.00168 20.8192 9.88205 21.25 12 21.25C14.118 21.25 15.9983 20.8192 17.3214 20.1576C18.6894 19.4736 19.25 18.6674 19.25 18V14.7072C18.8733 15.0077 18.4459 15.2724 17.9923 15.4992C16.42 16.2854 14.3003 16.75 12 16.75C9.69967 16.75 7.58004 16.2854 6.00774 15.4992C5.55414 15.2724 5.12675 15.0077 4.75 14.7072V18ZM19.25 8.70722V12C19.25 12.6674 18.6894 13.4736 17.3214 14.1576C15.9983 14.8192 14.118 15.25 12 15.25C9.88205 15.25 8.00168 14.8192 6.67856 14.1576C5.31057 13.4736 4.75 12.6674 4.75 12V8.70722C5.12675 9.00772 5.55414 9.27245 6.00774 9.49925C7.58004 10.2854 9.69967 10.75 12 10.75C14.3003 10.75 16.42 10.2854 17.9923 9.49925C18.4459 9.27245 18.8733 9.00772 19.25 8.70722Z"
        fill="currentColor"
      />
    </svg>

    <!-- Table Icon - dbdocs style -->
    <svg
      v-else-if="type === 'table'"
      viewBox="0 0 11 9"
      xmlns="http://www.w3.org/2000/svg"
      class="w-4 h-4"
    >
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M8.48864 0.818182H1.63636C1.18449 0.818182 0.818182 1.18449 0.818182 1.63636V7.36364C0.818182 7.81551 1.18449 8.18182 1.63636 8.18182H8.48864C8.94051 8.18182 9.30682 7.81551 9.30682 7.36364V1.63636C9.30682 1.18449 8.94051 0.818182 8.48864 0.818182ZM1.63636 0C0.732625 0 0 0.732625 0 1.63636V7.36364C0 8.26737 0.732625 9 1.63636 9H8.48864C9.39237 9 10.125 8.26737 10.125 7.36364V1.63636C10.125 0.732625 9.39237 0 8.48864 0H1.63636Z"
        fill="currentColor"
      />
      <path
        d="M0 1.63636C0 0.732625 0.732625 0 1.63636 0H8.48864C9.39237 0 10.125 0.732625 10.125 1.63636V2.25H0V1.63636Z"
        fill="currentColor"
      />
    </svg>

    <!-- Column/Field Icon - dbdocs style -->
    <svg
      v-else-if="type === 'column' || type === 'column-pk' || type === 'column-unique' || type === 'column-required'"
      viewBox="0 0 12 10"
      height="10"
      width="12"
      xmlns="http://www.w3.org/2000/svg"
      class="w-4 h-4"
    >
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M9.43182 0.909091H1.81818C1.3161 0.909091 0.909091 1.3161 0.909091 1.81818V8.18182C0.909091 8.6839 1.3161 9.09091 1.81818 9.09091H9.43182C9.9339 9.09091 10.3409 8.6839 10.3409 8.18182V1.81818C10.3409 1.3161 9.9339 0.909091 9.43182 0.909091ZM1.81818 0C0.814028 0 0 0.814028 0 1.81818V8.18182C0 9.18597 0.814028 10 1.81818 10H9.43182C10.436 10 11.25 9.18597 11.25 8.18182V1.81818C11.25 0.814028 10.436 0 9.43182 0H1.81818Z"
        fill="currentColor"
      />
      <path
        d="M0 1.81818C0 0.814028 0.814028 0 1.81818 0H9.43182C10.436 0 11.25 0.814028 11.25 1.81818V2.5H0V1.81818Z"
        fill="currentColor"
      />
      <rect
        x="2.99994"
        y="2.5"
        width="2.22222"
        height="6.58889"
        fill="currentColor"
      />
      <!-- Primary key indicator -->
      <circle
        v-if="type === 'column-pk'"
        cx="8.5"
        cy="5.5"
        r="1.2"
        fill="currentColor"
        opacity="0.8"
      />
      <!-- Unique indicator -->
      <circle
        v-if="type === 'column-unique'"
        cx="8.5"
        cy="5.5"
        r="1"
        stroke="currentColor"
        stroke-width="0.8"
        fill="none"
      />
      <!-- Required indicator -->
      <text
        v-if="type === 'column-required'"
        x="8.5"
        y="6.5"
        text-anchor="middle"
        font-size="3"
        fill="currentColor"
        font-weight="bold"
      >!</text>
    </svg>

    <!-- Index Icon -->
    <svg
      v-else-if="type === 'index'"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class="w-4 h-4"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
        stroke="currentColor"
      />
    </svg>

    <!-- Enum Icon - "E" in a gray box -->
    <svg
      v-else-if="type === 'enum'"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      class="w-4 h-4"
    >
      <rect
        x="1"
        y="1"
        width="14"
        height="14"
        rx="2"
        fill="currentColor"
        opacity="0.2"
        stroke="currentColor"
        stroke-width="1"
      />
      <text
        x="8"
        y="11"
        text-anchor="middle"
        font-size="10"
        font-weight="bold"
        fill="currentColor"
      >E</text>
    </svg>

    <!-- Ref Icon - dbdocs style -->
    <svg
      v-else-if="type === 'ref'"
      fill="none"
      viewBox="0 0 64 64"
      height="16"
      width="16"
      xmlns="http://www.w3.org/2000/svg"
      class="w-4 h-4"
    >
      <ellipse
        cx="12.8"
        cy="30.8"
        rx="4.8"
        ry="4.8"
        fill="currentColor"
      />
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M12.8008 30.7999C12.8008 29.4744 13.8753 28.3999 15.2008 28.3999H53.6008C54.9263 28.3999 56.0008 29.4744 56.0008 30.7999C56.0008 32.1254 54.9263 33.1999 53.6008 33.1999H15.2008C13.8753 33.1999 12.8008 32.1254 12.8008 30.7999Z"
        fill="currentColor"
      />
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M52.9146 14.7203C53.8423 15.667 53.8268 17.1865 52.8801 18.1142L40.2295 30.5103L52.8801 42.9065C53.8268 43.8342 53.8423 45.3537 52.9146 46.3004C51.9869 47.2472 50.4674 47.2626 49.5207 46.3349L35.1207 32.2246C34.66 31.7731 34.4004 31.1553 34.4004 30.5103C34.4004 29.8654 34.66 29.2475 35.1207 28.7961L49.5207 14.6858C50.4674 13.7581 51.9869 13.7735 52.9146 14.7203Z"
        fill="currentColor"
      />
    </svg>

    <!-- Project Icon - Clean folder -->
    <svg
      v-else-if="type === 'project'"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class="w-4 h-4"
    >
      <path
        d="M4 21H20C21.1046 21 22 20.1046 22 19V8C22 6.89543 21.1046 6 20 6H11L9.29687 3.4453C9.1114 3.1671 8.79917 3 8.46482 3H4C2.89543 3 2 3.89543 2 5V19C2 20.1046 2.89543 21 4 21Z"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>

    <!-- TableGroup Icon - dbdocs style -->
    <svg
      v-else-if="type === 'tableGroup'"
      fill="none"
      viewBox="0 0 13 12"
      height="12"
      width="13"
      xmlns="http://www.w3.org/2000/svg"
      class="w-4 h-4"
    >
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M0 1.70455C0 0.901222 0.651222 0.25 1.45455 0.25H7.54545C8.34878 0.25 9 0.901222 9 1.70455V2.25V3.75H11.5455C12.3488 3.75 13 4.40122 13 5.20455V5.75V10.2955C13 11.0988 12.3488 11.75 11.5455 11.75H5.45455C4.65122 11.75 4 11.0988 4 10.2955V8.25H1.45455C0.651222 8.25 0 7.59878 0 6.79545V2.25V1.70455ZM4.72727 8.25H4.75V7.52273H4.72727V5.75H8.27273H9H12.2727V10.2955C12.2727 10.6971 11.9471 11.0227 11.5455 11.0227H5.45455C5.05288 11.0227 4.72727 10.6971 4.72727 10.2955V8.25ZM8.27273 3.75H5.45455C4.65122 3.75 4 4.40122 4 5.20455V5.75V7.52273H1.45455C1.05288 7.52273 0.727273 7.19712 0.727273 6.79545V2.25H8.27273V3.75Z"
        fill="currentColor"
      />
    </svg>

    <!-- TablePartial Icon -->
    <svg
      v-else-if="type === 'tablePartial'"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class="w-4 h-4"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 011-1h1a2 2 0 100-4H7a1 1 0 01-1-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"
        stroke="currentColor"
      />
    </svg>

    <!-- Array Icon - Square brackets [] -->
    <svg
      v-else-if="type === 'array'"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      class="w-4 h-4"
    >
      <path
        d="M15,3h2a1,1,0,0,1,1,1V20a1,1,0,0,1-1,1H15"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        fill="none"
      />
      <path
        d="M9,3H7A1,1,0,0,0,6,4V20a1,1,0,0,0,1,1H9"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        fill="none"
      />
    </svg>

    <!-- Object Icon - Curly braces {} -->
    <svg
      v-else-if="type === 'object'"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      class="w-4 h-4"
    >
      <path
        d="M15,3h2a1,1,0,0,1,1,1v6a2,2,0,0,0,2,2h0a2,2,0,0,0-2,2v6a1,1,0,0,1-1,1H15"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        fill="none"
      />
      <path
        d="M9,3H7A1,1,0,0,0,6,4v6a2,2,0,0,1-2,2H4a2,2,0,0,1,2,2v6a1,1,0,0,0,1,1H9"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        fill="none"
      />
    </svg>

    <!-- Data Inspector Icon -->
    <svg
      v-else-if="type === 'data-inspector'"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class="w-4 h-4"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        stroke="currentColor"
      />
    </svg>

    <!-- Note Icon -->
    <svg
      v-else-if="type === 'note'"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class="w-4 h-4"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
        stroke="currentColor"
      />
    </svg>

    <!-- Default/Unknown Icon -->
    <svg
      v-else
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class="w-4 h-4"
    >
      <circle
        cx="12"
        cy="12"
        r="3"
        stroke="currentColor"
        stroke-width="2"
      />
      <path
        d="M12 1v6m0 6v6m11-7h-6m-6 0H1"
        stroke="currentColor"
        stroke-width="2"
      />
    </svg>
  </span>
</template>

<script setup lang="ts">
interface Props {
  type: string;
  iconClass?: string;
}

withDefaults(defineProps<Props>(), {
  iconClass: 'text-gray-600',
});
</script>
